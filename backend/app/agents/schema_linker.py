import json
import re
import math
from app.llm.factory import get_llm
from app.core.config import settings

class SemanticVectorSchemaRetriever:
    """
    Semantic vector retrieval over database schema descriptions.
    Fulfills Proposal Section 6.3 #1: Embedding-based schema pruning for enterprise context-window scalability.
    """
    def __init__(self, dim: int = 256):
        self.dim = dim
        self.table_vectors: dict[str, list[float]] = {}
        self.table_blocks: dict[str, str] = {}

    def _text_to_vector(self, text: str) -> list[float]:
        vec = [0.0] * self.dim
        tokens = re.findall(r'[a-zA-Z0-9_]+', text.lower())
        for token in tokens:
            # Token feature
            h = abs(hash(token)) % self.dim
            vec[h] += 1.0
            # Character n-gram features for subword semantics
            for i in range(len(token) - 2):
                ngram = token[i:i+3]
                h_ng = abs(hash(ngram)) % self.dim
                vec[h_ng] += 0.5
        norm = math.sqrt(sum(x * x for x in vec))
        return [x / norm for x in vec] if norm > 0 else vec

    def index_schema(self, full_schema: str):
        self.table_vectors.clear()
        self.table_blocks.clear()
        blocks = full_schema.split("\n\n")
        for block in blocks:
            match = re.search(r"CREATE\s+TABLE\s+([a-zA-Z0-9_]+)", block, re.IGNORECASE)
            if match:
                table_name = match.group(1).lower()
                self.table_blocks[table_name] = block
                self.table_vectors[table_name] = self._text_to_vector(f"{table_name} {block}")

    def search(self, query: str, top_k: int = 10) -> list[tuple[str, float]]:
        if not self.table_vectors:
            return []
        q_vec = self._text_to_vector(query)
        scores = []
        for t_name, t_vec in self.table_vectors.items():
            cosine_sim = sum(a * b for a, b in zip(q_vec, t_vec))
            scores.append((t_name, round(cosine_sim, 4)))
        scores.sort(key=lambda x: x[1], reverse=True)
        return scores[:top_k]

class SchemaLinkerAgent:
    def __init__(self, provider: str | None = None, model: str | None = None):
        self.retriever = SemanticVectorSchemaRetriever()
        self.set_routing(provider=provider, model=model)

    def set_routing(self, provider: str | None = None, model: str | None = None):
        if provider is not None:
            self.provider = provider
        elif not hasattr(self, "provider"):
            self.provider = settings.SCHEMA_LINKER_PROVIDER or settings.DEFAULT_LLM_PROVIDER

        if model is not None:
            self.model = model
        elif not hasattr(self, "model"):
            self.model = settings.SCHEMA_LINKER_MODEL

        self.llm = get_llm(provider=self.provider, model=self.model)

    async def link_schema(self, question: str, full_schema: str, history: str = "") -> str:
        # Step 1: Semantic Vector Schema Retrieval
        self.retriever.index_schema(full_schema)
        semantic_ranked = self.retriever.search(f"{question} {history}")
        
        table_matches = re.findall(r"CREATE\s+TABLE\s+([a-zA-Z0-9_]+)", full_schema, re.IGNORECASE)
        available_tables = list(dict.fromkeys(table_matches))
        if not available_tables:
            return full_schema

        # If schema is vast (> 8 tables), prune down to top semantic candidates before LLM prompt
        if len(available_tables) > 8:
            candidate_tables = [t for t, _ in semantic_ranked[:8]]
        else:
            candidate_tables = available_tables

        # Format semantic ranking context
        rank_str = ", ".join([f"{t} (similarity: {s})" for t, s in semantic_ranked[:5]])

        system_prompt = (
            "You are a database schema expert. Given a user's question, conversation history, and available database tables, "
            f"identify which tables are needed to answer the question.\n"
            f"Candidate tables: {candidate_tables}\n"
            f"Semantic vector similarity ranking: [{rank_str}]\n"
            "Output ONLY a valid JSON array of table name strings that are relevant, e.g. [\"table1\", \"table2\"]. "
            "Do not include any explanation or markdown formatting."
        )
        prompt = f"Question: {question}\nConversation History:\n{history}"
        
        try:
            response = await self.llm.generate(prompt, system_prompt=system_prompt, model=self.model, max_tokens=300)
            text = response.strip()
            if text.startswith("```json"):
                text = text[7:]
            elif text.startswith("```"):
                text = text[3:]
            if text.endswith("```"):
                text = text[:-3]
            
            match = re.search(r"\[.*?\]", text, re.DOTALL)
            if match:
                selected_tables = json.loads(match.group(0))
            else:
                selected_tables = json.loads(text.strip())
                
            if not isinstance(selected_tables, list) or len(selected_tables) == 0:
                return full_schema
                
            selected_set = {str(t).strip().lower() for t in selected_tables}
            blocks = full_schema.split("\n\n")
            filtered_blocks = [
                b for b in blocks 
                if any(re.search(rf"CREATE\s+TABLE\s+{re.escape(t)}\b", b, re.IGNORECASE) for t in selected_set)
            ]
            
            return "\n\n".join(filtered_blocks) if filtered_blocks else full_schema
        except Exception:
            return full_schema
