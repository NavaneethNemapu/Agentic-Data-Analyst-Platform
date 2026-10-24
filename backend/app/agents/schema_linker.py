import json
import re
from app.llm.factory import get_llm
from app.core.config import settings

class SchemaLinkerAgent:
    def __init__(self, provider: str | None = None, model: str | None = None):
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
        # Extract available table names from full_schema
        table_matches = re.findall(r"CREATE\s+TABLE\s+([a-zA-Z0-9_]+)", full_schema, re.IGNORECASE)
        available_tables = list(dict.fromkeys(table_matches))
        if not available_tables:
            return full_schema

        system_prompt = (
            "You are a database schema expert. Given a user's question, conversation history, and available database tables, "
            f"identify which tables are needed to answer the question.\n"
            f"Available tables: {available_tables}\n"
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
