from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Header, HTTPException
from app.services.pipeline import WorkflowStateMachine
from app.schemas.query import QueryRequest, QueryResponse
from app.core.security import decode_access_token
import json

router = APIRouter()
pipeline = WorkflowStateMachine()

@router.post("/", response_model=QueryResponse)
async def submit_query(req: QueryRequest, authorization: str | None = Header(None)):
    try:
        user_id = req.user_id
        if not user_id and authorization and authorization.startswith("Bearer "):
            token = authorization[7:].strip()
            decoded = decode_access_token(token)
            if decoded:
                user_id = decoded.get("sub")

        return await pipeline.run(
            req.question, 
            req.session_id, 
            models=req.models, 
            providers=req.providers,
            user_id=user_id
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/async")
async def submit_query_async(req: QueryRequest):
    """Enqueue agentic query pipeline as an asynchronous background Celery task."""
    try:
        from tasks.tasks import execute_query_async
        task = execute_query_async.delay(
            req.question,
            session_id=req.session_id,
            providers=req.providers,
            models=req.models
        )
        return {"task_id": task.id, "status": "queued"}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Async Celery worker unavailable: {str(e)}")

@router.get("/tasks/{task_id}")
async def get_task_status(task_id: str):
    """Check status of asynchronous background Celery task."""
    try:
        from tasks.worker import celery_app
        task = celery_app.AsyncResult(task_id)
        if task.state == "PENDING":
            return {"task_id": task_id, "status": "pending"}
        elif task.state == "SUCCESS":
            return {"task_id": task_id, "status": "completed", "result": task.result}
        elif task.state == "FAILURE":
            return {"task_id": task_id, "status": "failed", "error": str(task.info)}
        return {"task_id": task_id, "status": task.state.lower()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.websocket("/stream")
async def websocket_query(websocket: WebSocket):
    await websocket.accept()
    try:
        data = await websocket.receive_text()
        payload = json.loads(data)
        question = payload.get("question")
        session_id = payload.get("session_id")
        models = payload.get("models")
        providers = payload.get("providers")
        user_id = payload.get("user_id")
        token = payload.get("token")
        
        if not user_id and token:
            decoded = decode_access_token(token)
            if decoded:
                user_id = decoded.get("sub")
        
        if not question:
            await websocket.send_json({"type": "error", "error": "Missing question"})
            await websocket.close()
            return
            
        async def progress_callback(update_dict):
            try:
                await websocket.send_json({"type": "progress", "data": update_dict})
            except Exception:
                pass
                
        result = await pipeline.run(
            question, 
            session_id, 
            progress_callback=progress_callback, 
            models=models,
            providers=providers,
            user_id=user_id
        )
        await websocket.send_json({"type": "result", "data": result})
        
    except WebSocketDisconnect:
        print("WebSocket disconnected")
    except Exception as e:
        await websocket.send_json({"type": "error", "error": str(e)})
    finally:
        try:
            await websocket.close()
        except Exception:
            pass
