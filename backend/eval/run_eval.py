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
        print(f"Ground truth execution failed: {e}")
        return []
    finally:
        conn.close()

def compare_results(predicted, ground_truth):
    if predicted is None:
        predicted = []
    
    if len(predicted) != len(ground_truth):
        return False
        
    pred_vals = [list(r.values()) for r in predicted]
    gt_vals = [list(r.values()) for r in ground_truth]
    
    # Sort for robust comparison
    pred_vals.sort(key=lambda x: str(x))
    gt_vals.sort(key=lambda x: str(x))
    
    return pred_vals == gt_vals

async def main():
    with open("eval/dev_subset.json", "r") as f:
        dataset = json.load(f)
        
    pipeline = WorkflowStateMachine()
    
    total = len(dataset)
    passed = 0
    total_latency = 0
    total_retries = 0
    
    print(f"Starting Evaluation on {total} questions...")
    print("-" * 50)
    
    for item in dataset:
        print(f"Q{item['question_id']}: {item['question']}")
        
        gt_sql = item['SQL']
        gt_result = execute_ground_truth(gt_sql)
        
        start_time = time.time()
        
        try:
            response = await pipeline.run(item['question'])
            predicted_result = response.get("result", [])
            retries = response.get("retries", 0)
        except Exception as e:
            print(f"  [Pipeline Error]: {e}")
            predicted_result = []
            retries = pipeline.max_retries
            
        latency = time.time() - start_time
        
        is_correct = compare_results(predicted_result, gt_result)
        
        if is_correct:
            passed += 1
            print(f"  [PASS] Latency: {latency:.2f}s | Retries: {retries}")
        else:
            print(f"  [FAIL] Latency: {latency:.2f}s | Retries: {retries}")
            print(f"    Expected: {gt_result}")
            print(f"    Got:      {predicted_result}")
            
        total_latency += latency
        total_retries += retries
        
    accuracy = (passed / total) * 100
    avg_latency = total_latency / total
    avg_retries = total_retries / total
    
    print("-" * 50)
    print("EVALUATION SUMMARY")
    print(f"Accuracy (EX): {accuracy:.1f}% ({passed}/{total})")
    print(f"Avg Latency:   {avg_latency:.2f}s")
    print(f"Avg Retries:   {avg_retries:.2f}")

if __name__ == "__main__":
    asyncio.run(main())
