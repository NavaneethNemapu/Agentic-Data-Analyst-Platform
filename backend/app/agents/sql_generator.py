import re
from app.llm.factory import get_llm
from app.core.config import settings
from app.db.target import get_dialect_name

from app.services.experience_bank import experience_bank

class SQLGeneratorAgent:
    def __init__(self, provider: str | None = None, model: str | None = None):
        self.set_routing(provider=provider, model=model)

    def set_routing(self, provider: str | None = None, model: str | None = None):
        if provider is not None:
            self.provider = provider
        elif not hasattr(self, "provider"):
            self.provider = settings.SQL_GENERATOR_PROVIDER or settings.DEFAULT_LLM_PROVIDER

        if model is not None:
            self.model = model
        elif not hasattr(self, "model"):
            self.model = settings.SQL_GENERATOR_MODEL

        self.llm = get_llm(provider=self.provider, model=self.model)

    async def generate_sql(self, question: str, schema: str, history: str = "") -> tuple[str, list[dict]]:
        dialect = get_dialect_name()
        
        # Original Contribution: Retrieve dynamic few-shot exemplars from verified Experience Bank
        exemplars = experience_bank.find_similar_exemplars(question, threshold=0.35, top_k=2)
        exemplar_text = ""
        if exemplars:
            exemplar_lines = [f"Q: {e['question']}\nSQL: {e['sql']}" for e in exemplars]
            exemplar_text = "\n\nVERIFIED ANALYST MEMORY (Similar Golden Queries from Experience Bank):\n" + "\n---\n".join(exemplar_lines)

        system_prompt = (
            f"You are an expert SQL data analyst. Given the database schema and conversation context, "
            f"write a valid {dialect} query to answer the user's question or follow-up question. "
            f"If the question refers to previous results (e.g. asking 'why?', 'show more details', 'break that down'), "
            f"use the conversation history to write the appropriate query that investigates or answers it.\n"
            f"CRITICAL GUIDELINES:\n"
            f"1. Column Selection: Select ONLY the specific columns requested. When grouping by an entity (e.g. each product, each customer), select the human-readable name/label (e.g. p.name, c.country) and the aggregate metric. Do NOT select internal numeric IDs (e.g. product_id, customer_id) unless the question explicitly asks for IDs.\n"
            f"2. String Filters: Always use case-insensitive matching for string literals, status, and category filters "
            f"(e.g. LOWER(status) = 'completed' or LOWER(category) = 'clothing') because databases like SQLite are case-sensitive by default.\n"
            f"3. Rounding: Round averages, ratios, and monetary metrics to 2 decimal places using ROUND(..., 2).\n"
            f"4. Sorting: If the question asks for 'highest', 'top', or 'lowest', apply the appropriate ORDER BY and LIMIT clauses.\n"
            f"{exemplar_text}\n"
            f"Output ONLY the raw SQL query, without markdown formatting, quotes, or explanation."
        )
        prompt = f"Database Dialect: {dialect}\n\nSchema:\n{schema}\n\nConversation History:\n{history}\n\nQuestion / Follow-up:\n{question}"
        
        response = await self.llm.generate(prompt, system_prompt=system_prompt, model=self.model, max_tokens=400)
        
        # Clean up markdown formatting if the LLM ignores instructions
        sql = response.strip()
        if sql.startswith("```sql"):
            sql = sql[6:]
        if sql.startswith("```"):
            sql = sql[3:]
        if sql.endswith("```"):
            sql = sql[:-3]
            
        return sql.strip(), exemplars

    async def correct_sql(self, previous_sql: str, error_msg: str, question: str, schema: str, history: str = "") -> str:
        dialect = get_dialect_name()
        system_prompt = (
            f"You are an expert SQL data analyst. You wrote a {dialect} query that failed with an error or validation feedback. "
            f"Given the database schema, the conversation context, the failed query, and the error/validation message, "
            f"write a corrected valid {dialect} query.\n"
            f"CORRECTION RULES:\n"
            f"- If the error mentions 0 rows or casing, use LOWER(column) = '...' for string comparisons.\n"
            f"- If the validation feedback says unrequested columns were included, remove them.\n"
            f"- Ensure all non-aggregated SELECT columns are in GROUP BY, and use ROUND(..., 2) for averages/revenues.\n"
            f"Output ONLY the raw SQL query, without markdown formatting."
        )
        prompt = (
            f"Database Dialect: {dialect}\n\n"
            f"Schema:\n{schema}\n\n"
            f"Conversation History:\n{history}\n\n"
            f"Question:\n{question}\n\n"
            f"Failed Query:\n{previous_sql}\n\n"
            f"Error Message:\n{error_msg}"
        )
        
        response = await self.llm.generate(prompt, system_prompt=system_prompt, model=self.model, max_tokens=400)
        
        sql = response.strip()
        if sql.startswith("```sql"):
            sql = sql[6:]
        if sql.startswith("```"):
            sql = sql[3:]
        if sql.endswith("```"):
            sql = sql[:-3]
            
        return sql.strip()
