from app.core.config import settings
from .base import BaseLLM
from .ollama import OllamaLLM
from .groq import GroqLLM
from .openai import OpenAILLM
from .anthropic import AnthropicLLM
from .gemini import GeminiLLM
from .adaptive import AdaptiveLLM

def resolve_provider_and_model(provider: str | None = None, model: str | None = None) -> tuple[str, str | None]:
    """
    Parse provider and model, supporting prefix notations like:
    - 'groq:openai/gpt-oss-120b'
    - 'openai:gpt-4o'
    - 'anthropic:claude-3-5-sonnet-20241022'
    - 'gemini:gemini-1.5-flash'
    - 'ollama:llama3.1'
    """
    clean_provider = provider
    clean_model = model

    if provider and ":" in provider:
        p_prefix, p_rest = provider.split(":", 1)
        p_prefix_lower = p_prefix.lower()
        if p_prefix_lower in ("groq", "ollama", "openai", "anthropic", "gemini", "sambanova", "samba", "auto"):
            clean_provider = p_prefix_lower
            clean_model = clean_model or p_rest

    if clean_model and ":" in clean_model:
        prefix, rest = clean_model.split(":", 1)
        prefix_lower = prefix.lower()
        if prefix_lower in ("groq", "ollama", "openai", "anthropic", "gemini", "sambanova", "samba", "auto"):
            clean_provider = clean_provider or prefix_lower
            clean_model = rest

    # Infer from well-known model name patterns if provider is not explicit
    if not clean_provider and clean_model:
        m_lower = clean_model.lower()
        if m_lower.startswith("claude"):
            clean_provider = "anthropic"
        elif m_lower.startswith(("gpt-4", "gpt-3.5", "o1", "o3", "chatgpt")):
            clean_provider = "openai"
        elif m_lower.startswith("gemini"):
            clean_provider = "gemini"
        elif "llama" in m_lower or "deepseek" in m_lower:
            if settings.SAMBANOVA_API_KEY:
                clean_provider = "sambanova"

    final_provider = (clean_provider or settings.DEFAULT_LLM_PROVIDER or "auto").lower()
    return final_provider, clean_model

def get_llm(provider: str | None = None, model: str | None = None) -> BaseLLM:
    """
    Factory function to get the configured LLM backend.
    Supported providers: 'auto' (smart local/cloud shift), 'groq', 'sambanova', 'ollama', 'openai', 'anthropic', 'gemini'.
    """
    resolved_provider, resolved_model = resolve_provider_and_model(provider, model)

    if resolved_provider in ("auto", "adaptive", "hybrid"):
        return AdaptiveLLM()
    if resolved_provider == "groq":
        return GroqLLM(model=resolved_model)
    if resolved_provider in ("sambanova", "samba"):
        samba_key = settings.SAMBANOVA_API_KEY or settings.OPENAI_API_KEY
        return OpenAILLM(
            api_key=samba_key,
            base_url="https://api.sambanova.ai/v1",
            model=resolved_model or "Meta-Llama-3.3-70B-Instruct"
        )
    if resolved_provider == "ollama":
        return OllamaLLM()
    if resolved_provider == "openai":
        return OpenAILLM(model=resolved_model)
    if resolved_provider == "anthropic":
        return AnthropicLLM(model=resolved_model)
    if resolved_provider == "gemini":
        return GeminiLLM(model=resolved_model)

    raise ValueError(
        f"Unsupported LLM provider: '{resolved_provider}'. "
        "Supported providers are: 'auto', 'groq', 'sambanova', 'ollama', 'openai', 'anthropic', 'gemini'."
    )
