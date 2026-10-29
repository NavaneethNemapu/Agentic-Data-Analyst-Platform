from fastapi import FastAPI
from app.core.config import settings
from app.api.query import router as query_router
from app.api.auth import router as auth_router

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
app.include_router(auth_router, prefix="/api/auth")

@app.get("/")
def read_root():
    return {"message": f"Welcome to {settings.PROJECT_NAME}"}

@app.get("/health")
def health_check():
    return {"status": "ok"}

import csv
import io
import os
import re
import sqlite3
from fastapi import UploadFile, File

@app.post("/api/upload-dataset")
async def upload_dataset(file: UploadFile = File(...)):
    """Upload custom CSV or SQLite database to query dynamically."""
    filename = file.filename or "uploaded_data"
    os.makedirs("data", exist_ok=True)
    
    if filename.endswith(".csv"):
        table_name = re.sub(r'[^a-zA-Z0-9_]', '_', os.path.splitext(filename)[0]).lower()
        content = await file.read()
        text_stream = io.StringIO(content.decode("utf-8", errors="ignore"))
        reader = csv.reader(text_stream)
        headers = next(reader, None)
        if not headers:
            return {"error": "CSV file is empty"}
        clean_headers = [re.sub(r'[^a-zA-Z0-9_]', '_', h.strip().lower()) or f"col_{i}" for i, h in enumerate(headers)]
        
        db_path = os.path.abspath("data/uploaded.db")
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        col_defs = ", ".join([f"{h} TEXT" for h in clean_headers])
        cur.execute(f"DROP TABLE IF EXISTS {table_name}")
        cur.execute(f"CREATE TABLE {table_name} ({col_defs})")
        
        placeholders = ", ".join(["?"] * len(clean_headers))
        rows = [row[:len(clean_headers)] + [""] * (len(clean_headers) - len(row)) for row in reader]
        cur.executemany(f"INSERT INTO {table_name} VALUES ({placeholders})", rows)
        conn.commit()
        conn.close()
        
        settings.TARGET_DB_URL = f"sqlite:///{db_path}"
        from app.db.target import get_db_info
        return {"status": "success", "db": get_db_info(), "message": f"Loaded {len(rows)} rows into table '{table_name}'"}

    elif filename.endswith((".sqlite", ".db", ".sqlite3")):
        db_path = os.path.abspath("data/uploaded.db")
        content = await file.read()
        with open(db_path, "wb") as f:
            f.write(content)
        settings.TARGET_DB_URL = f"sqlite:///{db_path}"
        from app.db.target import get_db_info
        return {"status": "success", "db": get_db_info(), "message": f"Loaded database '{filename}'"}
    
    return {"error": "Unsupported file format. Please upload a .csv, .sqlite, or .db file."}

@app.post("/api/reset-dataset")
def reset_dataset():
    """Reset target database back to default e-commerce dataset."""
    settings.TARGET_DB_URL = "sqlite:///./data/target.db"
    from app.db.target import get_db_info
    return {"status": "success", "db": get_db_info(), "message": "Restored default e-commerce database"}

from pydantic import BaseModel

class ConnectDatabaseRequest(BaseModel):
    db_url: str

@app.post("/api/connect-database")
def connect_database(req: ConnectDatabaseRequest):
    """Connect dynamically to an external PostgreSQL, MySQL, or custom SQLite database URL from the web UI."""
    url = req.db_url.strip()
    if not url:
        return {"status": "error", "message": "Database connection URL cannot be empty."}
        
    try:
        from sqlalchemy import create_engine
        test_engine = create_engine(url)
        with test_engine.connect() as conn:
            pass  # Test connection handshake
            
        settings.TARGET_DB_URL = url
        from app.db.target import get_db_info
        info = get_db_info()
        return {
            "status": "success",
            "db": info,
            "message": f"Successfully connected to {info['dialect']} ({len(info['tables'])} tables indexed)"
        }
    except Exception as e:
        return {"status": "error", "message": f"Connection failed: {str(e)}"}

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

