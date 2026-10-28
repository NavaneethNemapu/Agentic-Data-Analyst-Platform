from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "data_analyst_tasks",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["tasks.tasks"]
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=300
)
