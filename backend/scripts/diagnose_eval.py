import asyncio
import json
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.services.pipeline import WorkflowStateMachine
from app.db.target import execute_query

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
        return False, f"Length mismatch: pred={len(predicted)}, gt={len(ground_truth)}"
    pred_vals = [list(r.values()) for r in predicted]
    gt_vals = [list(r.values()) for r in ground_truth]
    
    # Check if number of columns matches
    if pred_vals and gt_vals and len(pred_vals[0]) != len(gt_vals[0]):
        return False, f"Column count mismatch: pred has {len(pred_vals[0])} cols ({list(predicted[0].keys())}), gt has {len(gt_vals[0])} cols"
        
    pred_vals.sort(key=lambda x: str(x))
    gt_vals.sort(key=lambda x: str(x))
    
    for i, (p_row, g_row) in enumerate(zip(pred_vals, gt_vals)):
        if not all(cell_match(p_val, g_val) for p_val, g_val in zip(p_row, g_row)):
            return False, f"Row {i} mismatch: pred={p_row}, gt={g_row}"
    return True, "Match"


async def main():
    dataset_path = os.path.join(os.path.dirname(__file__), "..", "eval", "benchmark_dataset.json")
    with open(dataset_path) as f:
        data = json.load(f)
    
    pipeline = WorkflowStateMachine()
    
    for item in data[6:]:
        qid = item["question_id"]
        q = item["question"]
        gt_sql = item["SQL"]
        gt_res = execute_query(gt_sql)
        print("=" * 70)
        print(f"Q{qid} [{item['difficulty']}]: {q}")
        print(f"GT SQL:\n  {gt_sql}")
        print(f"GT Result Count: {len(gt_res)}, sample: {gt_res[:2]}")
        
        try:
            res = await pipeline.run(q)
            pred_sql = res.get("sql")
            pred_res = res.get("result", [])
            print(f"Predicted SQL:\n  {pred_sql}")
            print(f"Pred Result Count: {len(pred_res) if pred_res else 0}, sample: {pred_res[:2] if pred_res else 'None'}")
            is_match, reason = compare_results(pred_res, gt_res)
            print(f"Match: {is_match} | Reason: {reason}")
            print(f"Retries: {res.get('retries')}, Status: {res.get('status')}")
            print(f"Plan: {res.get('plan')}")
            print(f"Pruned Schema:\n{res.get('pruned_schema')}")
        except Exception as e:
            print(f"Pipeline Exception: {e}")

if __name__ == "__main__":
    asyncio.run(main())
