import httpx
from .base import BaseLLM
from app.core.config import settings

class AnthropicLLM(BaseLLM):
    """
    Anthropic Claude API provider (Claude 3.5 Sonnet, Haiku, Opus, etc.).
    """
    def __init__(self, api_key: str | None = None, model: str | None = None):
        self.api_key = api_key or settings.ANTHROPIC_API_KEY
        self.default_model = model or "claude-3-5-sonnet-20241022"
        self.url = "https://api.anthropic.com/v1/messages"

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
                "Anthropic API key is missing. Please set ANTHROPIC_API_KEY in your .env file or environment variables."
            )

        target_model = model or self.default_model
        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
        }

        payload = {
            "model": target_model,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": max_tokens,
            "temperature": 0.0
        }
        if system_prompt:
            payload["system"] = system_prompt

        async with httpx.AsyncClient() as client:
            response = await client.post(self.url, headers=headers, json=payload, timeout=60.0)
            if response.status_code != 200:
                raise ValueError(f"Anthropic API error ({response.status_code}): {response.text}")
            data = response.json()
            return data["content"][0]["text"]
