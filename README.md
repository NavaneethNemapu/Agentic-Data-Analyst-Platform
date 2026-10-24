# Agentic AI Data Analyst Assistant

A multi-agent, natural-language-to-SQL system that lets users query a relational database in plain English and returns the answer as data, an explanation, and a chart.

## Architecture
- **Schema Linker**: Selects relevant tables/columns.
- **Query Planner**: Decomposes complex questions.
- **SQL Generator**: Writes and self-corrects SQL.
- **Validator**: Checks results and suggests charts.

## Phase 0: Setup
- Configuration via environment variables is located in `.env.example` and `backend/app/core/config.py`.
- Tests are set up using `pytest`. Run them with `pytest` from the `backend/` directory.
