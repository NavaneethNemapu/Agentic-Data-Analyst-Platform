import httpx
from .base import BaseLLM
from app.core.config import settings

class OllamaLLM(BaseLLM):
    def __init__(self, base_url: str | None = None):
        self.base_url = base_url or settings.OLLAMA_BASE_URL

    async def _get_installed_models(self, client: httpx.AsyncClient) -> list[str]:
        try:
            r = await client.get(f"{self.base_url}/api/tags", timeout=5.0)
            if r.status_code == 200:
                data = r.json()
                return [m.get("name", "") for m in data.get("models", [])]
        except Exception:
            pass
        return []

    async def generate(self, prompt: str, system_prompt: str | None = None, model: str | None = None, **kwargs) -> str:
        target_model = model or "llama3.1"
        url = f"{self.base_url}/api/generate"
        
        async with httpx.AsyncClient() as client:
            # If target_model is a cloud-prefixed model (e.g. 'openai/...'), use first installed Ollama model
            if "/" in target_model:
                installed = await self._get_installed_models(client)
                if installed:
                    target_model = installed[0].split(":")[0]

            payload = {
                "model": target_model,
                "prompt": prompt,
                "stream": False
            }
            if system_prompt:
                payload["system"] = system_prompt
            if "max_tokens" in kwargs and kwargs["max_tokens"]:
                payload["options"] = {"num_predict": kwargs["max_tokens"]}

            try:
                response = await client.post(url, json=payload, timeout=180.0)
            except httpx.ConnectError:
                raise ValueError(
                    f"Could not connect to Ollama at {self.base_url}. Please ensure Ollama is running ('ollama serve')."
                )

            if response.status_code == 404:
                # If requested model is not downloaded, fallback to any installed model
                installed = await self._get_installed_models(client)
                if installed:
                    # Pick first installed model name
                    fallback = installed[0].split(":")[0]
                    print(f"Warning: Model '{target_model}' not found in Ollama. Falling back to installed '{fallback}'. (Run 'ollama pull {target_model}' to install it).")
                    payload["model"] = fallback
                    response = await client.post(url, json=payload, timeout=180.0)

            if response.status_code != 200:
                raise ValueError(f"Ollama error ({response.status_code}): {response.text}")
                
            data = response.json()
            return data.get("response", "")
