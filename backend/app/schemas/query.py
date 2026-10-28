from pydantic import BaseModel
from typing import Any

class QueryRequest(BaseModel):
    question: str
    session_id: str | None = None
    user_id: str | None = None
    models: dict[str, str] | None = None
    providers: dict[str, str] | None = None


class StepResult(BaseModel):
    step: Any
    sql: str = ""
    result: list[dict[str, Any]] | None = None
    error: str | None = None
    retries: int = 0

class QueryResponse(BaseModel):
    session_id: str | None = None
    question: str
    pruned_schema: str | None = None
    plan: list[Any] | None = None
    steps: list[StepResult] | None = None
    sql: str = ""
    result: list[dict[str, Any]] | None = None
    error: str | None = None
    status: str
    retries: int = 0
    explanation: str | None = None
    chart_type: str | None = None
    suggestions: list[str] | None = None
    confidence: float | None = None
    memory_exemplars: list[dict[str, Any]] | None = None
    models_used: dict[str, str | None] | None = None
    providers_used: dict[str, str | None] | None = None


