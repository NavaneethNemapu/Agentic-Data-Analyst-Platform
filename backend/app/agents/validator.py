from app.llm.factory import get_llm
from app.core.config import settings
import json

class ValidatorAgent:
    def __init__(self, provider: str | None = None, model: str | None = None):
        self.set_routing(provider=provider, model=model)

    def set_routing(self, provider: str | None = None, model: str | None = None):
        if provider is not None:
            self.provider = provider
        elif not hasattr(self, "provider"):
            self.provider = settings.VALIDATOR_PROVIDER or settings.DEFAULT_LLM_PROVIDER

        if model is not None:
            self.model = model
        elif not hasattr(self, "model"):
            self.model = settings.VALIDATOR_MODEL

        self.llm = get_llm(provider=self.provider, model=self.model)

    async def validate(self, question: str, sql: str, result: list, history: str = "") -> dict:
        system_prompt = (
            "You are an expert Senior Data Analyst. Your task is twofold:\n"
            "1. Verify if the generated SQL query and its execution result accurately answer the user's question.\n"
            "   - If the user asks for records (e.g. customers, orders, categories, top items) and the result set is EMPTY (0 rows), "
            "mark 'is_valid': false and explain in 'feedback' that string matching may have failed due to casing (e.g. 'completed' vs 'Completed') "
            "or an overly strict filter, and instruct to use LOWER(column) or re-check table values.\n"
            "   - If the SQL query selects columns completely unrelated or includes extra unneeded primary keys when names/aggregates were asked, provide corrective feedback.\n"
            "2. Provide a thoughtful, conversational, plain-English explanation that acts like a true analyst:\n"
            "   - If this is a follow-up question (e.g. asking 'why?', comparing to earlier numbers, or drilling down), "
            "synthesize the current results with the conversation history to explain the underlying reasons and drivers.\n"
            "   - Highlight key trends, notable anomalies, top contributors, or business takeaways rather than just reciting raw rows.\n"
            "   - Be direct, professional, and conversational.\n"
            "3. Propose 3 to 4 smart, relevant follow-up questions ('suggestions') that logically continue or drill down into this specific analysis.\n"
            "4. Visualization format rule:\n"
            "   - For single-number, single-word, or one-line answers (e.g. a single total count, a name, a scalar number), or general questions, ALWAYS set 'chart_type': 'none'.\n"
            "   - Only suggest 'bar', 'line', or 'pie' when there are at least two distinct data rows with numeric values to compare.\n"
            "   - If tabular breakdown is not useful or it's a simple scalar, set 'chart_type': 'none'.\n"
            "Output ONLY a valid JSON object with five keys:\n"
            '"is_valid": boolean,\n'
            '"feedback": string (corrective feedback if invalid, or empty string if valid),\n'
            '"explanation": string (rich, conversational analytical explanation with insights and answers to follow-ups),\n'
            '"chart_type": string (suggested chart type: "bar", "line", "pie", "table", "none"),\n'
            '"suggestions": list of 3-4 concise string questions specifically exploring the current findings'
        )
        sample_result = str(result)[:1500]
        prompt = (
            f"Conversation History:\n{history}\n\n"
            f"Current Question / Follow-up:\n{question}\n\n"
            f"Executed SQL Query:\n{sql}\n\n"
            f"Result Snippet:\n{sample_result}"
        )
        
        try:
            response = await self.llm.generate(prompt, system_prompt=system_prompt, model=self.model, max_tokens=650)
            text = response.strip()
            if text.startswith("```json"):
                text = text[7:]
            elif text.startswith("```"):
                text = text[3:]
            if text.endswith("```"):
                text = text[:-3]
            
            data = json.loads(text.strip())
            raw_sugg = data.get("suggestions", [])
            suggestions = [str(s).strip() for s in raw_sugg if isinstance(s, (str, int, float)) and str(s).strip()][:4] if isinstance(raw_sugg, list) else []
            return {
                "is_valid": bool(data.get("is_valid", True)),
                "feedback": data.get("feedback", ""),
                "explanation": data.get("explanation", "Here are your results."),
                "chart_type": data.get("chart_type", "table"),
                "suggestions": suggestions
            }
        except Exception:
            return {
                "is_valid": True,
                "feedback": "",
                "explanation": "Here are your results.",
                "chart_type": "table",
                "suggestions": []
            }
