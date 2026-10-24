import httpx
from .base import BaseLLM
from app.core.config import settings

class OpenAILLM(BaseLLM):
    """
    OpenAI API provider (also supports any OpenAI-compatible endpoint such as
    DeepSeek, OpenRouter, Together AI, vLLM via OPENAI_BASE_URL).
    """
    def __init__(self, api_key: str | None = None, model: str | None = None, base_url: str | None = None):
        self.api_key = api_key or settings.OPENAI_API_KEY
        self.default_model = model or "gpt-4o-mini"
        base = base_url or settings.OPENAI_BASE_URL or "https://api.openai.com/v1"
        self.url = f"{base.rstrip('/')}/chat/completions"

    async def generate(
        self,
        prompt: str,
        system_prompt: str | None = None,
        model: str | None = None,
        max_tokens: int = 1500,
        **kwargs
    ) -> str:
        if not self.api_key:
            raise ValueError(
                "OpenAI API key is missing. Please set OPENAI_API_KEY in your .env file or environment variables."
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

        payload = {
            "model": target_model,
            "messages": messages,
            "temperature": 0.0,
            "max_tokens": max_tokens
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(self.url, headers=headers, json=payload, timeout=60.0)
            if response.status_code != 200:
                raise ValueError(f"OpenAI API error ({response.status_code}): {response.text}")
            data = response.json()
            return data["choices"][0]["message"]["content"]
