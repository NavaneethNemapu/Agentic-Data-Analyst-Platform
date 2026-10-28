import asyncio
from .worker import celery_app
from app.services.pipeline import WorkflowStateMachine

@celery_app.task(name="tasks.execute_query_async", bind=True)
def execute_query_async(self, question: str, session_id: str | None = None, providers: dict | None = None, models: dict | None = None):
    """
    Asynchronous Celery background task for running the agentic query pipeline.
    """
    pipeline = WorkflowStateMachine()
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        result = loop.run_until_complete(
            pipeline.run(question, session_id=session_id, providers=providers, models=models)
        )
        return result
    finally:
        loop.close()
