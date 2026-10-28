import json
import time
import asyncio
import sqlite3
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.services.pipeline import WorkflowStateMachine
from app.llm.factory import get_llm
from app.core.config import settings

def execute_ground_truth(sql: str):
    db_path = settings.TARGET_DB_URL.replace("sqlite:///", "")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    try:
        cursor.execute(sql)
        rows = cursor.fetchall()
        return [dict(row) for row in rows]
    except Exception as e:
        return []
    finally:
        conn.close()

def cell_match(a, b):
    if a is None and b is None:
        return True
    try:
        fa, fb = float(a), float(b)
        return abs(fa - fb) < 0.05
    except (ValueError, TypeError):
        return str(a).strip().lower() == str(b).strip().lower()

def compare_results(predicted, ground_truth):
    if predicted is None:
        predicted = []
    if len(predicted) != len(ground_truth):
        return False
    pred_vals = [list(r.values()) for r in predicted]
    gt_vals = [list(r.values()) for r in ground_truth]
    
    if pred_vals and gt_vals and len(pred_vals[0]) != len(gt_vals[0]):
        return False
        
    pred_vals.sort(key=lambda x: str(x))
    gt_vals.sort(key=lambda x: str(x))
    
    for p_row, g_row in zip(pred_vals, gt_vals):
        if not all(cell_match(p_val, g_val) for p_val, g_val in zip(p_row, g_row)):
            return False
    return True

def classify_failure(predicted, ground_truth, error_msg, sql_query):
    """Classifies queries into the academic error taxonomy specified in Proposal Section 8.5."""
    if error_msg:
        err = error_msg.lower()
        if "syntax" in err or "unrecognized" in err or "parse" in err:
            return "Syntax Error"
        if "no such column" in err or "unknown column" in err:
            return "Hallucinated Column"
        if "no such table" in err or "relation" in err:
            return "Hallucinated Table"
        if "timeout" in err:
            return "Query Timeout"
        return "Database Execution Error"
    
    if not predicted or len(predicted) == 0:
        return "Empty Result (Filter Mismatch)"
    
    if len(predicted) != len(ground_truth):
        return "Incorrect Join / Filter Constraint"
    
    return "Aggregation / Value Mismatch"

async def run_monolithic_baseline(question: str, schema_str: str, model: str = "openai/gpt-oss-20b") -> dict:
    """Simulates standard single-prompt LLM without agent pipeline or retry loop."""
    llm = get_llm(provider="groq", model=model)
    prompt = f"Schema:\n{schema_str}\n\nQuestion: {question}\nWrite only SQLite SQL query:"
    t0 = time.time()
    try:
        resp = await llm.generate(prompt, max_tokens=250)
        sql = resp.replace("```sql", "").replace("```", "").strip()
        from app.db.target import execute_query
        result = execute_query(sql)
        elapsed = time.time() - t0
        return {
            "sql": sql,
            "result": result,
            "retries": 0,
            "latency": elapsed,
            "error": None,
            "explanation": "Direct single-prompt query."
        }
    except Exception as e:
        elapsed = time.time() - t0
        return {
            "sql": None,
            "result": [],
            "retries": 0,
            "latency": elapsed,
            "error": str(e),
            "explanation": "Execution failed."
        }

async def benchmark_suite():
    dataset_file = os.path.join(os.path.dirname(__file__), "benchmark_dataset.json")
    with open(dataset_file, "r") as f:
        questions = json.load(f)

    from app.db.target import get_schema
    schema_str = get_schema()
    pipeline = WorkflowStateMachine()

    configs = [
        {
            "id": "monolithic",
            "name": "1. Monolithic Single-LLM (Direct Prompt, No Agents)",
            "type": "baseline",
            "model": "openai/gpt-oss-20b"
        },
        {
            "id": "all_groq_agentic",
            "name": "2. Agentic Pipeline: All-Groq (20B + 27B + 120B)",
            "type": "agentic",
            "providers": {"schema_linker": "groq", "query_planner": "groq", "sql_generator": "groq", "validator": "groq"},
            "models": {"schema_linker": "openai/gpt-oss-20b", "query_planner": "qwen/qwen3.8-27b", "sql_generator": "openai/gpt-oss-120b", "validator": "openai/gpt-oss-120b"}
        },
        {
            "id": "hybrid_agentic",
            "name": "3. Agentic Pipeline: Heterogeneous Hybrid (Groq 120B + Gemini 3.6 Analyst)",
            "type": "agentic",
            "providers": {"schema_linker": "groq", "query_planner": "groq", "sql_generator": "groq", "validator": "gemini"},
            "models": {"schema_linker": "openai/gpt-oss-20b", "query_planner": "qwen/qwen3.8-27b", "sql_generator": "openai/gpt-oss-120b", "validator": "gemini-3.6-flash"}
        }
    ]

    report = {}

    for cfg in configs:
        print(f"\nEvaluating: {cfg['name']}...")
        tier_stats = {
            "Easy": {"total": 0, "pass": 0},
            "Medium": {"total": 0, "pass": 0},
            "Hard": {"total": 0, "pass": 0},
            "Extra Hard": {"total": 0, "pass": 0}
        }
        error_taxonomy = {}
        total_latency = 0
        total_retries = 0
        valid_sql_count = 0
        healed_errors = 0

        for item in questions:
            diff = item.get("difficulty", "Medium")
            tier_stats[diff]["total"] += 1
            gt_sql = item["SQL"]
            gt_result = execute_ground_truth(gt_sql)

            if cfg["type"] == "baseline":
                res = await run_monolithic_baseline(item["question"], schema_str, cfg["model"])
                pred = res["result"]
                lat = res["latency"]
                ret = 0
                is_valid_sql = res["error"] is None
                err_msg = res["error"]
                gen_sql = res["sql"]
            else:
                t0 = time.time()
                try:
                    res = await pipeline.run(item["question"], providers=cfg["providers"], models=cfg["models"])
                    lat = time.time() - t0
                    pred = res.get("result", [])
                    ret = res.get("retries", 0)
                    is_valid_sql = res.get("status") == "success" or res.get("sql") is not None
                    err_msg = res.get("error")
                    gen_sql = res.get("sql")
                    if ret > 0 and compare_results(pred, gt_result):
                        healed_errors += 1
                except Exception as e:
                    lat = time.time() - t0
                    pred = []
                    ret = 3
                    is_valid_sql = False
                    err_msg = str(e)
                    gen_sql = None

            total_latency += lat
            total_retries += ret
            if is_valid_sql:
                valid_sql_count += 1

            passed = compare_results(pred, gt_result)
            if passed:
                tier_stats[diff]["pass"] += 1
            else:
                err_type = classify_failure(pred, gt_result, err_msg, gen_sql)
                error_taxonomy[err_type] = error_taxonomy.get(err_type, 0) + 1
            
            print(f"  [{diff}] Q{item['question_id']}: {'PASS' if passed else 'FAIL'} ({lat:.2f}s, Retries: {ret})")

        total_q = len(questions)
        total_passed = sum(t["pass"] for t in tier_stats.values())
        overall_acc = (total_passed / total_q) * 100
        vsr = (valid_sql_count / total_q) * 100
        avg_lat = total_latency / total_q

        report[cfg["id"]] = {
            "name": cfg["name"],
            "overall_accuracy": round(overall_acc, 1),
            "valid_sql_rate": round(vsr, 1),
            "avg_latency": round(avg_lat, 2),
            "total_retries": total_retries,
            "healed_errors": healed_errors,
            "tier_accuracy": {
                k: round((v["pass"] / v["total"]) * 100, 1) if v["total"] > 0 else 0
                for k, v in tier_stats.items()
            },
            "error_taxonomy": error_taxonomy
        }

    # Save results to json
    results_path = os.path.join(os.path.dirname(__file__), "benchmark_results.json")
    with open(results_path, "w") as f:
        json.dump(report, f, indent=2)

    print("\n" + "=" * 84)
    print("COMPREHENSIVE NUMERICAL BENCHMARK SCORECARD")
    print("=" * 84)
    print(f"{'Metric':<32} | {'1. Monolithic (Baseline)':<18} | {'2. All-Groq Agentic':<18} | {'3. Hybrid Multi-Agent':<18}")
    print("-" * 84)
    
    m = report["monolithic"]
    g = report["all_groq_agentic"]
    h = report["hybrid_agentic"]

    print(f"{'Overall Execution Acc (EX)':<32} | {m['overall_accuracy']:>16.1f}% | {g['overall_accuracy']:>16.1f}% | {h['overall_accuracy']:>16.1f}%")
    print(f"{'Valid SQL Rate (VSR)':<32} | {m['valid_sql_rate']:>16.1f}% | {g['valid_sql_rate']:>16.1f}% | {h['valid_sql_rate']:>16.1f}%")
    for diff in ["Easy", "Medium", "Hard", "Extra Hard"]:
        print(f"{'  - ' + diff + ' Tier':<32} | {m['tier_accuracy'].get(diff, 0):>16.1f}% | {g['tier_accuracy'].get(diff, 0):>16.1f}% | {h['tier_accuracy'].get(diff, 0):>16.1f}%")
    print(f"{'Self-Healing Recoveries':<32} | {m['healed_errors']:>18} | {g['healed_errors']:>18} | {h['healed_errors']:>18}")
    print(f"{'Average Latency':<32} | {m['avg_latency']:>16.2f}s | {g['avg_latency']:>16.2f}s | {h['avg_latency']:>16.2f}s")
    print("=" * 84)
    print("\nERROR TAXONOMY ANALYSIS (Proposal Section 8.5):")
    all_err_keys = set(list(m["error_taxonomy"].keys()) + list(g["error_taxonomy"].keys()) + list(h["error_taxonomy"].keys()))
    for err_cat in sorted(all_err_keys):
        print(f"  * {err_cat:<35}: Baseline={m['error_taxonomy'].get(err_cat, 0)}, All-Groq={g['error_taxonomy'].get(err_cat, 0)}, Hybrid={h['error_taxonomy'].get(err_cat, 0)}")

if __name__ == "__main__":
    asyncio.run(benchmark_suite())
