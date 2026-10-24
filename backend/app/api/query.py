from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.pipeline import WorkflowStateMachine
from app.schemas.query import QueryRequest, QueryResponse
import json

router = APIRouter()
pipeline = WorkflowStateMachine()

from fastapi import HTTPException

@router.post("/", response_model=QueryResponse)
async def submit_query(req: QueryRequest):
    try:
        return await pipeline.run(req.question, req.session_id, models=req.models, providers=req.providers)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

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
            providers=providers
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
