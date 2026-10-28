import os
import uuid
from sqlalchemy import create_engine, Column, Integer, String, Text, ForeignKey, DateTime, Float, text
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from datetime import datetime
from app.core.config import settings

# Create directory for SQLite if it's used
if settings.SYSTEM_DB_URL.startswith("sqlite"):
    db_path = settings.SYSTEM_DB_URL.replace("sqlite:///", "")
    os.makedirs(os.path.dirname(db_path), exist_ok=True)

engine = create_engine(settings.SYSTEM_DB_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    username = Column(String(80), unique=True, index=True, nullable=False)
    email = Column(String(120), unique=True, index=True, nullable=False)
    hashed_password = Column(String(128), nullable=False)
    salt = Column(String(64), nullable=False)
    role = Column(String(50), default="Data Analyst")
    created_at = Column(DateTime, default=datetime.utcnow)

    sessions = relationship("ChatSession", back_populates="user", cascade="all, delete-orphan")
    queries = relationship("UserQuery", back_populates="user", cascade="all, delete-orphan")

class ChatSession(Base):
    __tablename__ = "chat_sessions"
    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    title = Column(String(200), default="Analysis Session")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="sessions")
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete")
    queries = relationship("UserQuery", back_populates="session")

class ChatMessage(Base):
    __tablename__ = "chat_messages"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, ForeignKey("chat_sessions.id", ondelete="CASCADE"))
    role = Column(String)  # 'user' or 'assistant'
    content = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    session = relationship("ChatSession", back_populates="messages")

class UserQuery(Base):
    __tablename__ = "user_queries"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    session_id = Column(String, ForeignKey("chat_sessions.id", ondelete="SET NULL"), nullable=True)
    question = Column(Text, nullable=False)
    sql = Column(Text, nullable=True)
    chart_type = Column(String(50), default="bar")
    confidence = Column(Float, default=0.92)
    status = Column(String(50), default="success")  # 'success' or 'error'
    retries = Column(Integer, default=0)
    is_pinned = Column(Integer, default=0)  # 1 if pinned to personal dashboard
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="queries")
    session = relationship("ChatSession", back_populates="queries")

# Safe migrations helper for existing SQLite databases
def init_db():
    Base.metadata.create_all(bind=engine)
    try:
        with engine.connect() as conn:
            result = conn.execute(text("PRAGMA table_info(chat_sessions)")).fetchall()
            col_names = [r[1] for r in result]
            if "user_id" not in col_names:
                conn.execute(text("ALTER TABLE chat_sessions ADD COLUMN user_id TEXT"))
            if "title" not in col_names:
                conn.execute(text("ALTER TABLE chat_sessions ADD COLUMN title TEXT DEFAULT 'Analysis Session'"))
            if "updated_at" not in col_names:
                conn.execute(text("ALTER TABLE chat_sessions ADD COLUMN updated_at DATETIME"))
            conn.commit()
    except Exception as e:
        print(f"DB migration notice: {e}")

init_db()
