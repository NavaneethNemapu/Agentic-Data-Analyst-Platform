from app.llm.factory import get_llm
from app.core.config import settings
import json

class QueryPlannerAgent:
    def __init__(self, provider: str | None = None, model: str | None = None):
        self.set_routing(provider=provider, model=model)

    def set_routing(self, provider: str | None = None, model: str | None = None):
        if provider is not None:
            self.provider = provider
        elif not hasattr(self, "provider"):
            self.provider = settings.QUERY_PLANNER_PROVIDER or settings.DEFAULT_LLM_PROVIDER

        if model is not None:
            self.model = model
        elif not hasattr(self, "model"):
            self.model = settings.QUERY_PLANNER_MODEL

        self.llm = get_llm(provider=self.provider, model=self.model)

    async def plan(self, question: str, schema: str, history: str = "") -> list[str]:
        system_prompt = (
            "You are a Query Planner agent. Your task is to plan the SQL execution steps for a natural-language question. "
            "IMPORTANT: Most data queries (including joins, aggregations, groupings, filtering, and ordering) must be answered in a SINGLE cohesive SQL query step. "
            "Do NOT split clauses of a single query (like JOIN, GROUP BY, ORDER BY) into separate steps. "
            "Only return multiple steps if the task fundamentally requires multiple distinct database operations. "
            "Output ONLY a valid JSON array of strings containing the query step(s), e.g. [\"Calculate total sales grouped by category\"]."
        )
        prompt = f"Schema:\n{schema}\n\nConversation History:\n{history}\n\nQuestion: {question}"
        
        response = await self.llm.generate(prompt, system_prompt=system_prompt, model=self.model, max_tokens=300)
        
        try:
            text = response.strip()
            if text.startswith("```json"):
                text = text[7:]
            elif text.startswith("```"):
                text = text[3:]
            if text.endswith("```"):
                text = text[:-3]
            
            steps = json.loads(text.strip())
            if isinstance(steps, list):
                cleaned = []
                for s in steps:
                    if isinstance(s, str):
                        cleaned.append(s)
                    elif isinstance(s, dict):
                        cleaned.append(str(s.get("step") or s.get("description") or s.get("action") or next(iter(s.values()), str(s))))
                    else:
                        cleaned.append(str(s))
                return cleaned if cleaned else [question]
            elif isinstance(steps, dict):
                arr = steps.get("steps") or steps.get("plan")
                if isinstance(arr, list):
                    return [str(s.get("step", s) if isinstance(s, dict) else s) for s in arr]
            return [question]
        except Exception:
            return [question]
