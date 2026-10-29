# Agentic AI Data Analyst Assistant
### A Heterogeneous Multi-Agent Architecture for Enterprise Natural-Language Database Analytics

[![Python Version](https://img.shields.io/badge/Python-3.11%2B-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110%2B-009688.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-19.0-61DAFB.svg)](https://react.dev/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![SQL Dialects](https://img.shields.io/badge/Dialects-PostgreSQL%20%7C%20MySQL%20%7C%20SQLite-orange.svg)](#supported-database-engines)

---

## Executive Summary

Extracting actionable business intelligence from enterprise relational databases (RDBMS) historically requires deep SQL expertise. This creates an engineering bottleneck between non-technical decision-makers and organizational data. While monolithic Large Language Models (LLMs) can generate elementary SQL, empirical benchmarks show they fail catastrophically on production schemas due to **context window saturation**, **multi-table join hallucinations**, **dialect mismatches**, and **silent semantic inaccuracies** (such as case-sensitivity traps returning empty result sets).

The **Agentic AI Data Analyst Assistant** resolves these failure modes through an end-to-end, production-grade **multi-agent consensus architecture**. By decomposing the text-to-SQL task across four specialized autonomous agents with a bounded **self-correcting perceive-act-observe-adjust feedback loop**, the system elevates execution accuracy from **52.4% (monolithic baseline) to 90.5%**, achieving a **100% Valid SQL Rate** across complex multi-table joins.

---

## Theoretical Foundation & Problem Formulation

### The Failure Modes of Monolithic Single-Shot Text-to-SQL

When a single LLM is prompted with `(User Question + Database Schema) -> SQL`, four systemic vulnerabilities emerge:

1. **Context Overflow & Schema Noise:** Real-world schemas contain hundreds of tables and thousands of columns. Passing the entire DDL overwhelms model attention, causing hallucinated column references.
2. **Join Path Ambiguity:** Queries spanning 3 to 5 relational tables require navigating foreign key dependencies. Single-shot prompts regularly drop intermediate linking tables or invert join orders.
3. **Dialect & Case Sensitivity Traps:** In engines like SQLite or binary-collation PostgreSQL, string filters default to case-sensitive matching (e.g., `WHERE status = 'completed'` yields 0 rows when rows contain `'Completed'`). Single-shot models silently return empty tables without detecting that an error occurred.
4. **Lack of Self-Correction:** When a syntax error or execution exception occurs at runtime, monolithic systems terminate with an error rather than inspecting the trace and self-healing.

### The Multi-Agent Hypothesis

> *Analytical reliability in text-to-SQL does not require exponentially larger foundation models; it requires **systemic decomposition**—segregating retrieval, planning, dialect generation, and validation into autonomous roles with execution feedback and memory recall.*

---

## Backend System Architecture

The core of the platform is an asynchronous, stateful orchestration pipeline governed by the `WorkflowStateMachine` in `app/services/pipeline.py`.

```mermaid
flowchart TD
    classDef client fill:#e0f2fe,stroke:#0284c7,stroke-width:2px,color:#0f172a;
    classDef agent fill:#fef3c7,stroke:#d97706,stroke-width:2px,color:#0f172a;
    classDef mem fill:#dcfce7,stroke:#16a34a,stroke-width:2px,color:#0f172a;
    classDef db fill:#f1f5f9,stroke:#475569,stroke-width:2px,color:#0f172a;
    classDef loop fill:#fee2e2,stroke:#dc2626,stroke-width:2px,color:#0f172a;

    UserQ["User Analytical Query\n(Natural Language)"]:::client --> Router{"Query Intent\nClassifier"}
    
    Router -->|"General Inquiry / Greeting"| DirectAns["Direct Conversational\nAnalyst Response"]:::agent
    Router -->|"Data Analytical Inquiry"| SchemaLinker["1. Schema Linker Agent\n(Dense Vector Retrieval + Schema Pruning)"]:::agent

    FullDDL[("Target Database Schema\n(Catalog & Metadata)")]:::db -.-> SchemaLinker
    SchemaLinker -->|"Pruned Schema Subgraph\n(Relevant Tables & Columns)"| QueryPlanner["2. Query Planner Agent\n(Deconstructs Multi-Step Subgoals)"]:::agent

    QueryPlanner -->|"Structured Analytical Steps"| SQLGen["3. SQL Generator Agent\n(Dialect Engine + Case Normalization)"]:::agent

    ExpBank[("Analyst Experience Replay\n(AER Vector Memory Store)")]:::mem <-->|"Semantic Exemplar Recall\n(Cosine Similarity >= 0.35)"| SQLGen

    SQLGen -->|"Synthesized Candidate SQL"| SandboxedDB[("Sandboxed Database Execution\n(Read-Only Mode / AST Blocklist)")]:::db

    SandboxedDB -->|"Raw Result Rows / Error Trace"| Validator{"4. Validator Agent\n(Semantic Result Verifier)"}:::agent

    Validator -->|"Database Syntax Error\nor Empty Filter Failure"| RetryGate{"Retry Limit\n(Max 3 Attempts)"}:::loop
    RetryGate -->|"Under Budget"| SelfHealing["SQL Generator Self-Correction\n(correct_sql with Runtime Trace)"]:::loop
    SelfHealing --> SandboxedDB
    RetryGate -->|"Exhausted"| FallbackErr["Graceful Analytical\nFailure Traceback"]:::loop

    Validator -->|"Verified Valid Insight"| FinalSynthesis["Analytical Synthesis Engine\n(Business Takeaways + Chart Recommendation)"]:::agent

    FinalSynthesis -.->|"Record Golden Query (Question, SQL)"| ExpBank
    FinalSynthesis --> ResultStream["WebSocket Progress Stream +\nVerified Payload to Frontend Client"]:::client
```

---

## Detailed Agent Decomposition

### 1. Schema Linker Agent (`app/agents/schema_linker.py`)
* **Objective:** Solve context window saturation and schema noise by isolating only the sub-schema necessary for the query.
* **Mechanism:**
  * Extracts structural table definitions and column comments from the connected database catalog.
  * Implements dense semantic character n-gram and token embedding vector indexing over table definitions.
  * Computes cosine similarity between user queries, conversational history, and database tables.
  * Prunes massive relational schemas down to a minimal, high-density DDL subset, saving up to 85% of LLM prompt tokens and preventing foreign-key hallucinations.

### 2. Query Planner Agent (`app/agents/query_planner.py`)
* **Objective:** Deconstruct complex, multi-layered business inquiries into a structured logical sequence of sub-operations.
* **Mechanism:**
  * Analyzes dependencies across analytical sub-goals (e.g., *Identify top-spending customers* $\rightarrow$ *Join with order history* $\rightarrow$ *Calculate month-over-month growth rate*).
  * Prevents premature SQL fragmentation, distinguishing queries that can be resolved in a single cohesive SQL query with Common Table Expressions (CTEs) or window functions versus queries requiring iterative context.

### 3. SQL Generator Agent (`app/agents/sql_generator.py`)
* **Objective:** Produce syntactically pristine, dialect-compliant SQL code.
* **Dialect Awareness:** Dynamically adjusts generation rules based on the connected engine:
  * **SQLite:** String concatenation with `||`, `strftime()` for datetime math, scalar date handling.
  * **PostgreSQL:** Explicit typing, `INTERVAL` arithmetic, `DATE_TRUNC()`, standard ANSI joins.
  * **MySQL / MariaDB:** Backtick identifiers, `DATE_ADD()`, `DATE_SUB()`, `IFNULL()`.
* **Guardrails & Best Practices Enforced:**
  * **Case-Insensitive String Filtering:** Enforces `LOWER(column) = 'value'` or `ILIKE` to eliminate zero-row casing traps.
  * **Numeric Precision:** Wraps computed ratios and currency in `ROUND(..., 2)`.
  * **Human-Readable Projection:** Always projects descriptive attributes (`name`, `category_name`, `email`) alongside numeric metrics instead of raw surrogate primary keys.
  * **Self-Healing Loop (`correct_sql`):** When execution errors or validator objections occur, the agent ingests the failing SQL, database exception trace, and original question to synthesize a corrected query.

### 4. Validator & Senior Analyst Agent (`app/agents/validator.py`)
* **Objective:** Eliminate silent semantic inaccuracies and translate raw tabular data into executive business intelligence.
* **Mechanism:**
  * **Semantic Sanity Checking:** Verifies row counts, column data types, and logical boundaries against the original user prompt.
  * **Zero-Row Trap Interception:** If a query executes without error but returns 0 rows on a populated database, the validator flags a filter mismatch and feeds it back to the self-healing loop for case-insensitive relaxation.
  * **Insight Synthesis:** Generates high-level executive summaries, explains key performance indicators (KPIs), identifies top contributors, and flags anomalies.
  * **Visual Chart Recommendation:** Recommends the optimal data visualization format (`bar`, `line`, `pie`, or `table`) based on dimensionality:
    * Categorical comparison $\rightarrow$ `bar`
    * Time-series trend $\rightarrow$ `line`
    * Proportional distribution $\rightarrow$ `pie`
    * Multi-dimensional records $\rightarrow$ `table`

---

## Original Academic Contribution: Analyst Experience Replay (AER)

Conventional multi-agent Text-to-SQL frameworks (such as MAC-SQL and MAG-SQL) are **stateless across query sessions**—they evaluate every analytical question from scratch, repeatedly vulnerable to known schema edge cases and unable to benefit from prior successful executions.

This project introduces **Analyst Experience Replay (AER)** via the `ExperienceBank` (`app/services/experience_bank.py`):

```
+-----------------------------------------------------------------------------------------+
|                       Analyst Experience Replay (AER) Architecture                       |
+-----------------------------------------------------------------------------------------+

 [Incoming Natural Language Query]
                 |
                 v
   [Dense Token & Character Embedder]
                 |
                 v
    (Query Vector Q_vec)
                 |
                 v
+----------------------------------+          Cosine Similarity Score
|    Experience Memory Store       |      sim(Q_vec, E_vec) = (Q . E) / (||Q|| * ||E||)
|  - Verified Experience Tuples:   | -----------------------------------------------------> Threshold tau >= 0.35
|    (Question, Golden SQL, Schema)|
+----------------------------------+
                 |
                 | (If sim >= 0.35: Recall Top-K Golden Exemplars)
                 v
+----------------------------------------------------+
|               SQL Generator Agent                  |
|  - Prompt Injected with Exact Golden Exemplars     | ===> Calibrated Confidence Score:
|  - In-Context Grounding on Past Verified Successes |      - Memory Hit: 0.96
+----------------------------------------------------+      - Verified 1st Attempt: 0.91
                 |                                          - Healed Execution: 0.82
                 v
   [Execution & Validation]
                 |
                 | (Upon Successful Verification)
                 v
[Dynamically Index New (Question, Verified SQL) Tuple into Experience Bank]
```

### Key Technical Advantages of AER:
1. **Dynamic Few-Shot Grounding:** Incoming queries compute cosine similarity against stored verified experiences. Exemplars exceeding threshold $\tau = 0.35$ are injected into the prompt as few-shot exemplars, effectively eliminating hallucinations for enterprise query patterns without model fine-tuning.
2. **Autonomous Knowledge Compounding:** As users interact with the system, validated query-SQL pairs are saved automatically, allowing the platform to continuously self-improve over time.
3. **Calibrated Confidence Scoring:** Returns a quantitative reliability metric $C \in [0.0, 1.0]$:
   * $C = 0.96$: Retrieved from verified Analyst Experience Memory.
   * $C = 0.91$: Executed and validated on the initial attempt.
   * $C = 0.82$: Executed successfully after autonomous self-healing retries.

---

## Pluggable Multi-Model Routing Layer

The architecture decouples the agent orchestration logic from underlying foundation models via the Unified LLM Factory (`app/llm/`):

| Provider Class | Primary Models Supported | Best Suited Agent Role | Key Characteristic |
|---|---|---|---|
| **GroqProvider** | `llama-3.3-70b-versatile`, `qwen-2.5-32b` | SQL Generator, Schema Linker | Ultra-low inference latency (~300-500 tokens/sec via LPU) |
| **GeminiProvider** | `gemini-2.5-flash`, `gemini-1.5-pro` | Validator & Analyst | Massive context window, deep semantic reasoning |
| **SambaNovaProvider** | `Meta-Llama-3.1-70B-Instruct`, `Qwen2.5-72B` | SQL Generator | High-throughput data-center inference |
| **OllamaProvider** | `qwen2.5-coder:7b`, `llama3:8b`, `deepseek-r1` | All Agents | Fully offline, privacy-compliant, zero API cost |
| **OpenAIProvider** | `gpt-4o`, `gpt-4o-mini`, `o1-mini` | Query Planner, Validator | Complex multi-step reasoning and decomposition |
| **AnthropicProvider**| `claude-3-5-sonnet`, `claude-3-haiku` | SQL Generator, Query Planner | Exceptional syntactic code generation accuracy |

Each agent's provider and model can be dynamically assigned at runtime without restarting the server.

---

## Security & Execution Sandboxing

Allowing arbitrary SQL generation against production databases presents severe security risks. The platform implements multi-tiered security defense-in-depth:

```
[Candidate SQL Query]
         |
         v
+--------------------------------------------------------------+
| Tier 1: Abstract Syntax Tree (AST) & Lexical Inspection      |
| Blocks DDL/DML Keywords: DROP, DELETE, UPDATE, ALTER,        |
| INSERT, TRUNCATE, EXEC, ATTACH, DETACH, PRAGMA, GRANT        |
+--------------------------------------------------------------+
         | (Pass)
         v
+--------------------------------------------------------------+
| Tier 2: Connection-Level Read-Only Isolation                 |
| - SQLite: sqlite3.connect("file:target.db?mode=ro", uri=True)|
| - PostgreSQL / MySQL: Session set to TRANSACTION READ ONLY   |
+--------------------------------------------------------------+
         | (Pass)
         v
+--------------------------------------------------------------+
| Tier 3: Query Execution Timeout & Bounded Row Limiting       |
| Enforces hard execution timeouts and row limits (LIMIT 1000) |
| to prevent denial-of-service (DoS) via Cartesian products    |
+--------------------------------------------------------------+
```

---

## Experimental Evaluation & Benchmark Results

### Evaluation Benchmark Dataset
An expanded benchmark suite consisting of **21 complex analytical questions** was established across four standardized difficulty tiers, modeled after academic standards from the **BIRD** and **Spider** benchmarks:

* **Easy (6 Questions):** Single-table aggregations, basic column projections, and simple conditions.
* **Medium (8 Questions):** Multi-table inner joins, `GROUP BY` aggregations, date-based filtering, and category rankings.
* **Hard (5 Questions):** 3-to-4 table relational joins, profit margin arithmetic, case-sensitive text matching, `HAVING` filters, and unplaced order outer joins.
* **Extra Hard (2 Questions):** Multi-level nested subqueries, customer retention rates, and cross-country Average Order Value (AOV) percentiles.

### Comparative Performance Metrics

| Metric | Monolithic Single-LLM Baseline (Llama-3.3-70B) | Multi-Agent Consensus Pipeline (All-Groq) | Relative Improvement |
|---|:---:|:---:|:---:|
| **Overall Execution Accuracy (EX)** | 52.4% | **90.5%** | **+72.7%** |
| **Valid SQL Rate (VSR)** | 85.7% | **100.0%** | **+16.7%** |
| **Easy Tier Accuracy (6 Qs)** | 100.0% | **100.0%** | Baseline Parity |
| **Medium Tier Accuracy (8 Qs)** | 50.0% | **100.0%** | **+100.0%** |
| **Hard Tier Accuracy (5 Qs)** | 20.0% | **80.0%** | **+300.0%** |
| **Extra Hard Tier Accuracy (2 Qs)** | 0.0% | **50.0%** | **+50.0% Abs.** |
| **Zero-Row Silent Failure Rate** | 14.3% (3 queries) | **4.7% (1 query)** | **-67.1%** |
| **Average End-to-End Latency** | 1.52s | 6.99s | Trade-off for Verification |
| **Self-Healing Retries Triggered** | 0 (No self-correction) | 3 Automatic Self-Corrections | Self-Healing Active |

---

## Academic Error Taxonomy & Failure Mode Analysis

Every failure observed during benchmarking was systematically cataloged into an academic error taxonomy to determine root causes and evaluate mitigations:

```
                  Text-to-SQL Failure Mode Taxonomy
                                  │
         ┌────────────────────────┼────────────────────────┐
         │                        │                        │
         ▼                        ▼                        ▼
 1. Empty Results         2. Database Execution    3. Join / Filter Path
 (Casing/Filter Trap)     Errors (Syntax/Collation) Ambiguity
         │                        │                        │
         ├─ Single Baseline: 3    ├─ Single Baseline: 3    ├─ Single Baseline: 2
         └─ Multi-Agent: 1        └─ Multi-Agent: 1        └─ Multi-Agent: 0
         (Fixed by LOWER() rule   (Fixed by perceive-act-  (Fixed by Schema
          & validator feedback)    observe retry loop)      Linker vector index)
```

| Error Category | Single-Shot Count | Multi-Agent Count | Root Cause Analysis & Agentic Resolution |
|---|:---:|:---:|---|
| **Empty Result (Filter Mismatch)** | 3 | 1 | SQLite and binary collation databases enforce case-sensitive string matching. Single-shot models generated `status = 'completed'` while database records contained `'Completed'`. Resolved by agent rule enforcing `LOWER()` and validator zero-row feedback loop. |
| **Database Execution Error** | 3 | 1 | Unqualified ambiguous column names and missing columns in `GROUP BY` clauses. Resolved by feeding database exception trace back to `correct_sql()`. |
| **Incorrect Join / Schema Hallucination** | 2 | 0 | The single-shot model omitted intermediate bridge tables (e.g., attempting to join `customers` directly to `products` without `orders` and `order_items`). Resolved by the Schema Linker's dense vector subgraph retrieval. |
| **Aggregation / Value Mismatch** | 2 | 0 | Unrounded floats and incorrect sorting criteria. Resolved by SQL Generator explicit business logic constraints. |

---

## Supported Database Engines

The platform connects dynamically to both file-based datasets and enterprise server databases without requiring code edits:

| Database Engine | Connection Mode | Configuration Pattern |
|---|---|---|
| **SQLite (Default)** | Local File / Web Upload | `sqlite:///./data/target.db` or upload `.sqlite`, `.db` directly via UI |
| **CSV Datasets** | In-Memory SQLite Ingestion | Upload any `.csv` file via UI; auto-creates normalized relational tables |
| **PostgreSQL** | Live Network Server / Cloud | `postgresql://user:password@localhost:5432/my_analytics_db` |
| **MySQL / MariaDB** | Live Network Server / Cloud | `mysql+pymysql://user:password@localhost:3306/my_analytics_db` |

---

## Presentation & Client Layer (Overview)

While the project's primary academic contribution resides in backend agent coordination and evaluation, a lightweight modern frontend was built to demonstrate operational capabilities:

* **Interactive Single-Page Application:** Built with **React 19** and **Vite**.
* **Real-Time Agent Thought Streaming:** Live WebSocket feed (`/api/query/stream`) visualizing agent transitions in real time (*Schema Linking* $\rightarrow$ *Query Planning* $\rightarrow$ *SQL Generation* $\rightarrow$ *Result Validation*).
* **Dynamic Business Intelligence Visualizations:** Client-side charting via **Recharts**, automatically rendering Bar Charts, Line Trends, Pie Distributions, or Data Tables based on the Validator's recommendation.
* **Live Database & Dataset Management:** Connect to live PostgreSQL / MySQL databases or upload custom CSV / SQLite files on-the-fly directly from the Settings dialog.

---

## Project Directory Structure

```
agentic-data-analyst/
├── backend/
│   ├── app/
│   │   ├── agents/
│   │   │   ├── schema_linker.py      # Dense semantic schema retriever & pruner
│   │   │   ├── query_planner.py      # Multi-step analytical decomposer
│   │   │   ├── sql_generator.py      # Dialect-accurate SQL generation & self-correction
│   │   │   └── validator.py          # Result verification & business insight synthesis
│   │   ├── api/
│   │   │   ├── query.py              # Synchronous, WebSocket, & Async endpoints
│   │   │   └── auth.py               # JWT authentication & session management
│   │   ├── core/
│   │   │   ├── config.py             # Environment settings & LLM provider configurations
│   │   │   └── security.py           # Password hashing & JWT token validation
│   │   ├── db/
│   │   │   ├── target.py             # Sandboxed SQL execution against target database
│   │   │   └── system_db.py          # Relational store for users, sessions, and chat history
│   │   ├── llm/
│   │   │   ├── base.py               # Abstract Base LLM Provider interface
│   │   │   ├── factory.py            # Dynamic multi-provider instantiation factory
│   │   │   ├── groq.py               # Groq LPU API client
│   │   │   ├── gemini.py             # Google Gemini API client
│   │   │   ├── sambanova.py          # SambaNova API client
│   │   │   ├── ollama.py             # Local Ollama client (offline privacy mode)
│   │   │   ├── openai.py             # OpenAI API client
│   │   │   └── anthropic.py          # Anthropic Claude API client
│   │   ├── schemas/
│   │   │   └── query.py              # Pydantic validation schemas
│   │   ├── services/
│   │   │   ├── pipeline.py           # WorkflowStateMachine orchestrator
│   │   │   └── experience_bank.py    # Analyst Experience Replay (AER) memory engine
│   │   └── main.py                   # FastAPI application root & dataset upload endpoints
│   ├── eval/
│   │   ├── dev_subset.json           # 21-question analytical benchmark suite
│   │   └── run_eval.py               # Benchmark evaluation harness
│   ├── seed_ecommerce_db.py          # Synthetic e-commerce database generator
│   ├── requirements.txt              # Backend dependencies
│   └── Dockerfile                    # Container definition
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── SettingsModal.jsx     # Database connection & agent routing modal
│   │   │   ├── UserDashboard.jsx     # Personal analytics & KPI dashboard
│   │   │   └── AuthModal.jsx         # Sign-in & registration dialog
│   │   ├── App.jsx                   # Primary chat workspace & WebSocket handler
│   │   └── index.css                 # Responsive stylesheet
│   └── package.json                  # Frontend dependencies
│
├── docker-compose.yml                # Unified multi-service deployment
└── README.md                         # Technical documentation & project report
```

---

## Installation & Setup Guide

### 1. Prerequisites
* **Python:** 3.11 or higher
* **Node.js:** 18 or higher
* **Git**

### 2. Backend Setup
```bash
# Navigate to backend directory
cd agentic-data-analyst/backend

# Create and activate a Python virtual environment
python -m venv .venv

# Windows:
.venv\Scripts\activate
# Linux/macOS:
# source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Seed the default e-commerce database (orders, customers, products, order_items)
python seed_ecommerce_db.py

# Configure environment variables
cp .env.example .env
# Edit .env and supply your preferred API key (e.g., GROQ_API_KEY, GEMINI_API_KEY)
```

### 3. Running the Backend Server
```bash
# Start FastAPI backend on http://127.0.0.1:8000
uvicorn app.main:app --reload --port 8000
```

### 4. Running the Benchmark Evaluation Harness
To reproduce the experimental results comparing the single-shot baseline with the multi-agent pipeline:
```bash
# Run the 21-question benchmark suite
python -m eval.run_eval
```

### 5. Running the Frontend Client
```bash
# In a new terminal, navigate to frontend directory
cd agentic-data-analyst/frontend

# Install dependencies
npm install

# Start Vite development server
npm run dev
# The workspace is now accessible at http://127.0.0.1:5173
```

---

## Summary for Academic & Supervisory Review

| Question | Architectural Answer |
|---|---|
| **What is the core contribution?** | Decomposition of text-to-SQL into a 4-agent consensus pipeline with bounded self-healing retries and a novel **Analyst Experience Replay (AER)** vector memory bank that enables continuous domain-specific learning without model fine-tuning. |
| **How does it perform vs. single LLMs?** | Execution accuracy increases from **52.4% to 90.5%**, and Valid SQL Rate reaches **100%**, with catastrophic multi-table join failures eliminated. |
| **How is database safety ensured?** | Multi-layered defense: Lexical/AST keyword rejection of all DDL/DML, connection-level read-only flags (`mode=ro`), and execution time limits. |
| **Can it scale to enterprise RDBMS?** | Yes. It natively connects to **PostgreSQL**, **MySQL**, and **SQLite**, with dynamic CSV ingestion and an asynchronous Celery/Redis task queue for long-running batch queries. |

---

## License

This project is developed as a Major Project for the Bachelor of Technology degree in Computer Science and Engineering and is licensed under the **MIT License**.
