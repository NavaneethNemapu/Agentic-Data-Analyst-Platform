from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "Agentic AI Data Analyst Assistant"
    
    # LLM Settings (options: auto, groq, ollama, openai, anthropic, gemini)
    DEFAULT_LLM_PROVIDER: str = "auto"
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    GROQ_API_KEY: str | None = None
    GROQ_MODEL: str = "openai/gpt-oss-120b"
    SAMBANOVA_API_KEY: str | None = None
    OPENAI_API_KEY: str | None = None
    OPENAI_BASE_URL: str | None = None
    ANTHROPIC_API_KEY: str | None = None
    GEMINI_API_KEY: str | None = None

    # Per-Agent Heterogeneous Provider & Model Routing
    SCHEMA_LINKER_PROVIDER: str | None = None
    SCHEMA_LINKER_MODEL: str | None = None

    QUERY_PLANNER_PROVIDER: str | None = None
    QUERY_PLANNER_MODEL: str | None = None

    SQL_GENERATOR_PROVIDER: str | None = None
    SQL_GENERATOR_MODEL: str | None = None

    VALIDATOR_PROVIDER: str | None = None
    VALIDATOR_MODEL: str | None = None

    # Database
    TARGET_DB_URL: str = "sqlite:///./data/target.db"
    SYSTEM_DB_URL: str = "sqlite:///./data/system.db"

    # Redis/Celery
    REDIS_URL: str = "redis://localhost:6379/0"

    # Security
    SECRET_KEY: str = "replace-this-in-production"

    model_config = SettingsConfigDict(env_file=".env", env_ignore_empty=True, extra="ignore")

settings = Settings()
