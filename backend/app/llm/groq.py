import httpx
from .base import BaseLLM
from app.core.config import settings

class GroqLLM(BaseLLM):
    def __init__(self, api_key: str | None = None, model: str | None = None):
        self.api_key = api_key or settings.GROQ_API_KEY
        self.default_model = model or settings.GROQ_MODEL
        self.url = "https://api.groq.com/openai/v1/chat/completions"

    async def generate(self, prompt: str, system_prompt: str | None = None, model: str | None = None, max_tokens: int = 1000) -> str:
        if not self.api_key:
            raise ValueError(
                "Groq API key is missing. Please set GROQ_API_KEY in your .env file or environment variables. "
                "You can get a free key at https://console.groq.com/keys"
            )

        target_model = model or self.default_model
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        # Groq supported models filter
        valid_groq_models = ["openai/gpt-oss-20b", "openai/gpt-oss-120b", "qwen/qwen3.8-27b"]
        if target_model not in valid_groq_models:
            target_model = "openai/gpt-oss-20b"

        payload = {
            "model": target_model,
            "messages": messages,
            "temperature": 0.0,
            "max_tokens": max_tokens
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(self.url, headers=headers, json=payload, timeout=60.0)
            if response.status_code != 200:
                # If model is over capacity (503), rate-limited (429), or failed, fallback to 20b
                if target_model != "openai/gpt-oss-20b":
                    payload["model"] = "openai/gpt-oss-20b"
                    response = await client.post(self.url, headers=headers, json=payload, timeout=60.0)
            if response.status_code != 200:
                raise ValueError(f"Groq API error ({response.status_code}): {response.text}")
            data = response.json()
            return data["choices"][0]["message"]["content"]
