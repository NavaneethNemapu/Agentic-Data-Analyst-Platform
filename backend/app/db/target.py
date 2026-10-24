from typing import Any
from sqlalchemy import create_engine, text, inspect
from app.core.config import settings

def get_engine():
    db_url = settings.TARGET_DB_URL
    if db_url.startswith("sqlite:///"):
        db_path = db_url.replace("sqlite:///", "")
        return create_engine(f"sqlite:///{db_path}?mode=ro", connect_args={"uri": True})
    return create_engine(db_url)

def get_dialect_name() -> str:
    db_url = settings.TARGET_DB_URL.lower()
    if db_url.startswith("postgres"):
        return "PostgreSQL"
    elif db_url.startswith("mysql"):
        return "MySQL"
    return "SQLite"

def execute_query(query: str) -> list[dict[str, Any]]:
    """Execute read-only SQL query on target DB."""
    # Basic safety check to prevent write or destructive queries
    cleaned = query.strip().lower()
    blocked_commands = ["drop ", "delete ", "insert ", "update ", "alter ", "truncate ", "grant ", "revoke "]
    if any(cleaned.startswith(cmd) or f"; {cmd}" in cleaned or f";\n{cmd}" in cleaned for cmd in blocked_commands):
        raise ValueError("Security error: Only read-only SELECT queries are allowed against the target database.")
        
    engine = get_engine()
    try:
        with engine.connect() as conn:
            result = conn.execute(text(query))
            if result.returns_rows:
                return [dict(row._mapping) for row in result.fetchall()]
            return []
    except Exception as e:
        raise ValueError(f"Database error: {str(e)}")

def get_schema() -> str:
    """Extract table and column definitions for PostgreSQL, MySQL, or SQLite."""
    engine = get_engine()
    try:
        inspector = inspect(engine)
        schema_definitions = []
        for table_name in inspector.get_table_names():
            columns = inspector.get_columns(table_name)
            col_defs = []
            for col in columns:
                col_name = col.get("name")
                col_type = str(col.get("type"))
                nullable = "" if col.get("nullable", True) else " NOT NULL"
                col_defs.append(f"  {col_name} {col_type}{nullable}")
                
            pk_constraint = inspector.get_pk_constraint(table_name)
            pk_cols = pk_constraint.get("constrained_columns", [])
            if pk_cols:
                col_defs.append(f"  PRIMARY KEY ({', '.join(pk_cols)})")
                
            fks = inspector.get_foreign_keys(table_name)
            for fk in fks:
                referred_table = fk.get("referred_table")
                constrained = fk.get("constrained_columns", [])
                referred = fk.get("referred_columns", [])
                if constrained and referred:
                    col_defs.append(f"  FOREIGN KEY ({', '.join(constrained)}) REFERENCES {referred_table}({', '.join(referred)})")
                    
            table_sql = f"CREATE TABLE {table_name} (\n" + ",\n".join(col_defs) + "\n);"
            schema_definitions.append(table_sql)
            
        return "\n\n".join(schema_definitions)
    except Exception as e:
        raise ValueError(f"Schema extraction error: {str(e)}")

def get_db_info() -> dict:
    """Return database dialect and list of tables for frontend status display."""
    try:
        engine = get_engine()
        inspector = inspect(engine)
        return {
            "dialect": get_dialect_name(),
            "tables": inspector.get_table_names(),
            "status": "connected"
        }
    except Exception as e:
        return {
            "dialect": get_dialect_name(),
            "tables": [],
            "status": f"error: {str(e)}"
        }
