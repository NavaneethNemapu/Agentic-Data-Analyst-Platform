from fastapi import FastAPI
from app.core.config import settings
from app.api.query import router as query_router

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title=settings.PROJECT_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(query_router, prefix="/api/query")

@app.get("/")
def read_root():
    return {"message": f"Welcome to {settings.PROJECT_NAME}"}

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.get("/api/info")
def get_system_info():
    from app.db.target import get_db_info
    return {
        "db": get_db_info(),
        "provider": settings.DEFAULT_LLM_PROVIDER,
        "available_providers": ["auto", "groq", "sambanova", "ollama", "openai", "anthropic", "gemini"],
        "providers": {
            "schema_linker": settings.SCHEMA_LINKER_PROVIDER or settings.DEFAULT_LLM_PROVIDER,
            "query_planner": settings.QUERY_PLANNER_PROVIDER or settings.DEFAULT_LLM_PROVIDER,
            "sql_generator": settings.SQL_GENERATOR_PROVIDER or settings.DEFAULT_LLM_PROVIDER,
            "validator": settings.VALIDATOR_PROVIDER or settings.DEFAULT_LLM_PROVIDER
        },
        "models": {
            "schema_linker": settings.SCHEMA_LINKER_MODEL,
            "query_planner": settings.QUERY_PLANNER_MODEL,
            "sql_generator": settings.SQL_GENERATOR_MODEL,
            "validator": settings.VALIDATOR_MODEL
        }
    }
