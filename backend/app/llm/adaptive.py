import logging
import time
import httpx
from .base import BaseLLM
from .groq import GroqLLM
from .ollama import OllamaLLM
from app.core.config import settings

logger = logging.getLogger(__name__)

class AdaptiveLLM(BaseLLM):
    """
    Adaptive LLM provider that intelligently routes between local LLMs (Ollama)
    and cloud API (Groq).

    - If Ollama is running, it automatically uses local LLMs.
    - If Ollama is offline or unavailable, it automatically uses Groq API.
    - If the active provider encounters an error or timeout during execution,
      it automatically falls back to the alternate provider so queries succeed without error.
    """
    _ollama_active: bool | None = None
    _last_check_timestamp: float = 0.0
    _CACHE_TTL: float = 4.0  # Check Ollama status at most once every 4 seconds

    def __init__(self, groq_llm: GroqLLM | None = None, ollama_llm: OllamaLLM | None = None):
        self.groq_llm = groq_llm or GroqLLM()
        self.ollama_llm = ollama_llm or OllamaLLM()
        self.ollama_base_url = settings.OLLAMA_BASE_URL

    async def is_ollama_online(self) -> bool:
        """
        Check if local Ollama server is running and reachable.
        Cached for _CACHE_TTL seconds to keep latency minimal.
        """
        now = time.time()
        if (
            AdaptiveLLM._ollama_active is not None
            and (now - AdaptiveLLM._last_check_timestamp) < AdaptiveLLM._CACHE_TTL
        ):
            return AdaptiveLLM._ollama_active

        try:
            async with httpx.AsyncClient() as client:
                res = await client.get(f"{self.ollama_base_url}/api/tags", timeout=0.8)
                if res.status_code == 200:
                    AdaptiveLLM._ollama_active = True
                    AdaptiveLLM._last_check_timestamp = now
                    return True
        except Exception:
            pass

        AdaptiveLLM._ollama_active = False
        AdaptiveLLM._last_check_timestamp = now
        return False

    async def generate(
        self,
        prompt: str,
        system_prompt: str | None = None,
        model: str | None = None,
        **kwargs
    ) -> str:
        ollama_up = await self.is_ollama_online()

        if ollama_up:
            primary, primary_name = self.ollama_llm, "Local Ollama"
            secondary, secondary_name = self.groq_llm, "Groq Cloud API"
        else:
            primary, primary_name = self.groq_llm, "Groq Cloud API"
            secondary, secondary_name = self.ollama_llm, "Local Ollama"

        try:
            return await primary.generate(prompt, system_prompt=system_prompt, model=model, **kwargs)
        except Exception as primary_err:
            logger.warning(
                f"[AdaptiveLLM] Primary provider '{primary_name}' failed ({primary_err}). "
                f"Falling back to '{secondary_name}'..."
            )
            # Invalidate status cache on failure
            AdaptiveLLM._ollama_active = not ollama_up
            AdaptiveLLM._last_check_timestamp = time.time()

            try:
                return await secondary.generate(prompt, system_prompt=system_prompt, model=model, **kwargs)
            except Exception as secondary_err:
                raise RuntimeError(
                    f"Both LLM providers failed. Primary ({primary_name}): {primary_err}; "
                    f"Fallback ({secondary_name}): {secondary_err}"
                )
