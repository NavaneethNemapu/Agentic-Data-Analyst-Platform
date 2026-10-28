import json
import time
import asyncio
import sqlite3
import os
import sys

# Ensure backend root is in PYTHONPATH
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.services.pipeline import WorkflowStateMachine
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

def score_analysis_quality(explanation: str, data: list) -> dict:
    """
    Evaluates the analytical explanation:
    1. Faithfulness / Hallucination Check: Are numbers cited in the explanation actually in the data?
    2. Depth: Does it provide business context, percentages, or actionable takeaways?
    """
    if not explanation or explanation == "Here are your results.":
        return {"faithfulness_score": 0.0, "word_count": len(explanation.split()), "has_business_takeaways": False}
    
    words = explanation.split()
    word_count = len(words)
    
    # Check if text contains analytical keywords
    keywords = ["lead", "dominate", "increase", "decrease", "average", "total", "higher", "lower", "revenue", "trend", "margin", "key", "performance"]
    has_keywords = any(k in explanation.lower() for k in keywords)
    
    # Check if numbers cited exist in the dataset
    data_str = str(data)
    import re
    numbers_in_text = re.findall(r'\b\d+(?:\.\d+)?\b', explanation)
    verified_numbers = 0
    for num in numbers_in_text:
        # Avoid counting small single digit integers like 1, 2
        if len(num) > 1 and num in data_str:
            verified_numbers += 1
            
    faithfulness = (verified_numbers / len(numbers_in_text)) if numbers_in_text else 1.0

    return {
        "word_count": word_count,
        "has_business_takeaways": has_keywords,
        "faithfulness_score": round(faithfulness * 100, 1)
    }

async def benchmark_configuration(name: str, routing_providers: dict, routing_models: dict, test_questions: list):
    print(f"\n=======================================================")
    print(f"BENCHMARKING CONFIGURATION: {name}")
    print(f"Providers: {routing_providers}")
    print(f"Models:    {routing_models}")
    print(f"=======================================================")
    
    pipeline = WorkflowStateMachine()
    
    total = len(test_questions)
    passed = 0
    total_latency = 0
    total_retries = 0
    explanations = []
    
    for item in test_questions:
        q_id = item["question_id"]
        question = item["question"]
        gt_sql = item["SQL"]
        gt_result = execute_ground_truth(gt_sql)
        
        t0 = time.time()
        try:
            res = await pipeline.run(
                question,
                providers=routing_providers,
                models=routing_models
            )
            elapsed = time.time() - t0
            pred_result = res.get("result", [])
            retries = res.get("retries", 0)
            explanation = res.get("explanation", "")
            chart_type = res.get("chart_type", "table")
        except Exception as e:
            elapsed = time.time() - t0
            pred_result = []
            retries = 3
            explanation = f"Error: {e}"
            chart_type = "none"
            
        is_correct = compare_results(pred_result, gt_result)
        if is_correct:
            passed += 1
            status_tag = "[PASS]"
        else:
            status_tag = "[FAIL]"
            
        quality = score_analysis_quality(explanation, pred_result)
        explanations.append({
            "question": question,
            "explanation": explanation,
            "chart_type": chart_type,
            "quality": quality
        })
        
        total_latency += elapsed
        total_retries += retries
        
        print(f"  Q{q_id}: {question[:45]}... -> {status_tag} in {elapsed:.2f}s (Retries: {retries})")
        print(f"      Chart: {chart_type} | Analysis Words: {quality['word_count']} | Faithfulness: {quality['faithfulness_score']}%")
        
    accuracy = (passed / total) * 100
    avg_latency = total_latency / total
    avg_retries = total_retries / total
    
    return {
        "name": name,
        "accuracy": accuracy,
        "avg_latency": avg_latency,
        "avg_retries": avg_retries,
        "explanations": explanations
    }

async def main():
    dev_path = os.path.join(os.path.dirname(__file__), "dev_subset.json")
    with open(dev_path, "r") as f:
        questions = json.load(f)
        
    configs = [
        {
            "name": "Config A: All-Groq (Ultra Fast LPU)",
            "providers": {
                "schema_linker": "groq",
                "query_planner": "groq",
                "sql_generator": "groq",
                "validator": "groq"
            },
            "models": {
                "schema_linker": "openai/gpt-oss-20b",
                "query_planner": "qwen/qwen3.8-27b",
                "sql_generator": "openai/gpt-oss-120b",
                "validator": "openai/gpt-oss-120b"
            }
        },
        {
            "name": "Config B: Hybrid Multi-LLM (Groq SQL + Gemini 3.6 Flash Analyst)",
            "providers": {
                "schema_linker": "groq",
                "query_planner": "groq",
                "sql_generator": "groq",
                "validator": "gemini"
            },
            "models": {
                "schema_linker": "openai/gpt-oss-20b",
                "query_planner": "qwen/qwen3.8-27b",
                "sql_generator": "openai/gpt-oss-120b",
                "validator": "gemini-3.6-flash"
            }
        }
    ]
    
    results = []
    for cfg in configs:
        res = await benchmark_configuration(cfg["name"], cfg["providers"], cfg["models"], questions)
        results.append(res)
        
    print("\n" + "=" * 65)
    print("FINAL COMPARATIVE SCORECARD")
    print("=" * 65)
    print(f"{'Configuration':<35} | {'Acc (EX)':<9} | {'Latency':<8} | {'Retries':<7}")
    print("-" * 65)
    for r in results:
        print(f"{r['name'][:35]:<35} | {r['accuracy']:>6.1f}%  | {r['avg_latency']:>6.2f}s | {r['avg_retries']:>6.2f}")
    print("=" * 65)

    print("\n" + "=" * 65)
    print("SAMPLE ANALYSIS COMPARISON (Q1)")
    print("=" * 65)
    for r in results:
        print(f"\n[{r['name']}] Explanation:")
        print(f"{r['explanations'][0]['explanation']}")

if __name__ == "__main__":
    asyncio.run(main())
