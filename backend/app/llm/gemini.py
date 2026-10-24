import httpx
from .base import BaseLLM
from app.core.config import settings

class GeminiLLM(BaseLLM):
    """
    Google Gemini API provider (Gemini 1.5 Flash, 1.5 Pro, 2.0 Flash, etc.).
    """
    def __init__(self, api_key: str | None = None, model: str | None = None):
        self.api_key = api_key or settings.GEMINI_API_KEY
        self.default_model = model or "gemini-3.6-flash"

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
                "Gemini API key is missing. Please set GEMINI_API_KEY in your .env file or environment variables."
            )

        target_model = model or self.default_model
        # Strip any prefix like 'gemini/' or 'models/'
        if target_model.startswith("gemini/"):
            target_model = target_model[7:]
        if target_model.startswith("models/"):
            target_model = target_model[7:]

        # Normalize deprecated model names to current working models
        if target_model in ("gemini-1.5-flash", "gemini-2.0-flash", "gemini-2.5-flash", "gemini-flash"):
            target_model = "gemini-3.6-flash"
        elif target_model in ("gemini-1.5-pro", "gemini-2.0-pro", "gemini-2.5-pro", "gemini-pro"):
            target_model = "gemini-3.6-flash"

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{target_model}:generateContent?key={self.api_key}"

        payload = {
            "contents": [{
                "parts": [{"text": prompt}]
            }],
            "generationConfig": {
                "temperature": 0.0,
                "maxOutputTokens": max_tokens
            }
        }
        if system_prompt:
            payload["system_instruction"] = {
                "parts": [{"text": system_prompt}]
            }

        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload, timeout=60.0)
            if response.status_code != 200:
                raise ValueError(f"Gemini API error ({response.status_code}): {response.text}")
            data = response.json()
            try:
                return data["candidates"][0]["content"]["parts"][0]["text"]
            except (KeyError, IndexError) as err:
                raise ValueError(f"Unexpected Gemini response structure: {data}") from err
