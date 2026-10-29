from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session
from app.db.system_db import SessionLocal, User, ChatSession, ChatMessage, UserQuery
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user_required,
    get_current_user_optional,
    get_db
)

router = APIRouter()

class SignupRequest(BaseModel):
    username: str
    email: str
    password: str
    role: Optional[str] = "Data Analyst"

class LoginRequest(BaseModel):
    username_or_email: str
    password: str

class UserProfileResponse(BaseModel):
    id: str
    username: str
    email: str
    role: str
    created_at: str

class AuthResponse(BaseModel):
    token: str
    user: UserProfileResponse

@router.post("/signup", response_model=AuthResponse)
def signup(req: SignupRequest, db: Session = Depends(get_db)):
    username = req.username.strip()
    email = req.email.strip().lower()
    
    if len(username) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters long.")
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters long.")
    if "@" not in email or "." not in email:
        raise HTTPException(status_code=400, detail="Please enter a valid email address.")

    # Check if username or email is already taken
    existing_user = db.query(User).filter((User.username == username) | (User.email == email)).first()
    if existing_user:
        if existing_user.username.lower() == username.lower():
            raise HTTPException(status_code=400, detail="Username is already taken.")
        else:
            raise HTTPException(status_code=400, detail="Email is already registered.")

    hashed_pw, salt = hash_password(req.password)
    new_user = User(
        username=username,
        email=email,
        hashed_password=hashed_pw,
        salt=salt,
        role=req.role or "Data Analyst"
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Seed starter analytical queries so new user gets an instant rich personal dashboard
    seed_starter_analytics(db, new_user.id)

    token = create_access_token({
        "sub": new_user.id,
        "username": new_user.username,
        "email": new_user.email,
        "role": new_user.role
    })

    return {
        "token": token,
        "user": {
            "id": new_user.id,
            "username": new_user.username,
            "email": new_user.email,
            "role": new_user.role,
            "created_at": new_user.created_at.isoformat()
        }
    }

@router.post("/login", response_model=AuthResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    identifier = req.username_or_email.strip()
    user = db.query(User).filter((User.username == identifier) | (User.email == identifier.lower())).first()
    
    if not user or not verify_password(req.password, user.hashed_password, user.salt):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username/email or password."
        )

    token = create_access_token({
        "sub": user.id,
        "username": user.username,
        "email": user.email,
        "role": user.role
    })

    return {
        "token": token,
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role,
            "created_at": user.created_at.isoformat()
        }
    }

@router.get("/me")
def get_me(user: User = Depends(get_current_user_required), db: Session = Depends(get_db)):
    query_count = db.query(UserQuery).filter(UserQuery.user_id == user.id).count()
    session_count = db.query(ChatSession).filter(ChatSession.user_id == user.id).count()
    return {
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role,
            "created_at": user.created_at.isoformat()
        },
        "stats": {
            "total_queries": query_count,
            "total_sessions": session_count
        }
    }

@router.get("/dashboard")
def get_dashboard(user: User = Depends(get_current_user_required), db: Session = Depends(get_db)):
    """Retrieves full personal dashboard analytics, recent queries, sessions, and pinned insights."""
    queries = db.query(UserQuery).filter(UserQuery.user_id == user.id).order_by(UserQuery.created_at.desc()).all()
    sessions = db.query(ChatSession).filter(ChatSession.user_id == user.id).order_by(ChatSession.updated_at.desc()).all()

    total_queries = len(queries)
    successful_queries = sum(1 for q in queries if q.status == "success")
    verified_rate = round((successful_queries / total_queries * 100), 1) if total_queries > 0 else 100.0
    avg_confidence = round(sum(q.confidence for q in queries) / total_queries, 2) if total_queries > 0 else 0.95
    pinned_count = sum(1 for q in queries if q.is_pinned == 1)

    # Domain / table distribution heuristics from SQL
    table_hits = {"orders": 0, "customers": 0, "products": 0, "order_items": 0, "categories": 0}
    for q in queries:
        sql_lower = (q.sql or "").lower()
        for tbl in table_hits.keys():
            if tbl in sql_lower:
                table_hits[tbl] += 1

    chart_type_dist = {"bar": 0, "line": 0, "pie": 0}
    for q in queries:
        ct = q.chart_type or "bar"
        chart_type_dist[ct] = chart_type_dist.get(ct, 0) + 1

    recent_queries_data = [
        {
            "id": q.id,
            "question": q.question,
            "sql": q.sql,
            "chart_type": q.chart_type,
            "confidence": q.confidence,
            "status": q.status,
            "retries": q.retries,
            "is_pinned": q.is_pinned == 1,
            "session_id": q.session_id,
            "created_at": q.created_at.isoformat()
        }
        for q in queries[:20]
    ]

    pinned_data = [q for q in recent_queries_data if q["is_pinned"]]

    sessions_data = []
    for s in sessions[:10]:
        msg_count = db.query(ChatMessage).filter(ChatMessage.session_id == s.id).count()
        sessions_data.append({
            "id": s.id,
            "title": s.title or "Analysis Session",
            "message_count": msg_count,
            "created_at": s.created_at.isoformat() if s.created_at else "",
            "updated_at": s.updated_at.isoformat() if s.updated_at else ""
        })

    return {
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role,
            "created_at": user.created_at.isoformat()
        },
        "metrics": {
            "total_queries": total_queries,
            "verified_rate": verified_rate,
            "avg_confidence": avg_confidence,
            "total_sessions": len(sessions),
            "pinned_count": pinned_count
        },
        "table_distribution": [{"table": k, "count": v} for k, v in table_hits.items() if v > 0] or [{"table": "orders", "count": 12}, {"table": "customers", "count": 8}, {"table": "products", "count": 6}],
        "chart_distribution": [{"type": k, "count": v} for k, v in chart_type_dist.items() if v > 0],
        "recent_queries": recent_queries_data,
        "pinned_insights": pinned_data,
        "recent_sessions": sessions_data
    }

@router.post("/queries/{query_id}/pin")
def toggle_pin(query_id: int, user: User = Depends(get_current_user_required), db: Session = Depends(get_db)):
    q = db.query(UserQuery).filter(UserQuery.id == query_id, UserQuery.user_id == user.id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Query record not found")
    q.is_pinned = 0 if q.is_pinned == 1 else 1
    db.commit()
    return {"id": q.id, "is_pinned": q.is_pinned == 1}

class SessionUpdateRequest(BaseModel):
    title: str

@router.get("/sessions")
def get_sessions(user: Optional[User] = Depends(get_current_user_optional), db: Session = Depends(get_db)):
    """Retrieve recent chat sessions for the active user or recent workspace sessions."""
    if user:
        sessions = db.query(ChatSession).filter(
            (ChatSession.user_id == user.id) | (ChatSession.user_id == None)
        ).order_by(ChatSession.updated_at.desc(), ChatSession.created_at.desc()).limit(50).all()
    else:
        sessions = db.query(ChatSession).order_by(
            ChatSession.updated_at.desc(), ChatSession.created_at.desc()
        ).limit(30).all()

    result = []
    for s in sessions:
        msg_count = db.query(ChatMessage).filter(ChatMessage.session_id == s.id).count()
        last_msg = db.query(ChatMessage).filter(ChatMessage.session_id == s.id).order_by(ChatMessage.created_at.desc()).first()
        result.append({
            "id": s.id,
            "title": s.title or "Analysis Session",
            "message_count": msg_count,
            "snippet": last_msg.content[:80] if last_msg else "",
            "created_at": s.created_at.isoformat() if s.created_at else "",
            "updated_at": s.updated_at.isoformat() if s.updated_at else (s.created_at.isoformat() if s.created_at else "")
        })
    return {"sessions": result}

@router.get("/sessions/{session_id}")
def get_session_details(session_id: str, db: Session = Depends(get_db)):
    """Retrieve full message history and query visualizations for a specific session."""
    sess = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
        
    messages = db.query(ChatMessage).filter(ChatMessage.session_id == session_id).order_by(ChatMessage.created_at.asc()).all()
    queries = db.query(UserQuery).filter(UserQuery.session_id == session_id).order_by(UserQuery.created_at.asc()).all()
    
    from app.db.target import execute_query
    
    query_map = {}
    for q in queries:
        query_map[q.question.strip().lower()] = q
        
    formatted_messages = []
    if not messages and queries:
        for q in queries:
            formatted_messages.append({
                "id": f"u_{q.id}",
                "role": "user",
                "content": q.question,
                "timestamp": q.created_at.strftime("%I:%M %p") if q.created_at else ""
            })
            res = None
            if q.sql:
                try:
                    res = execute_query(q.sql)
                except Exception:
                    pass
            formatted_messages.append({
                "id": f"asst_{q.id}",
                "role": "assistant",
                "content": f"Verified insight from your analysis session.",
                "sql": q.sql,
                "result": res if isinstance(res, list) else None,
                "chart_type": q.chart_type or "bar",
                "confidence": q.confidence or 0.95,
                "isError": q.status == "error",
                "timestamp": q.created_at.strftime("%I:%M %p") if q.created_at else ""
            })
    else:
        last_user_question = None
        for m in messages:
            msg_data = {
                "id": f"msg_{m.id}",
                "role": m.role,
                "content": m.content,
                "timestamp": m.created_at.strftime("%I:%M %p") if m.created_at else ""
            }
            if m.role == "user":
                last_user_question = m.content
            elif m.role == "assistant":
                matched_q = None
                if last_user_question:
                    matched_q = query_map.get(last_user_question.strip().lower())
                if not matched_q and queries:
                    matched_q = queries[-1]
                if matched_q:
                    msg_data["sql"] = matched_q.sql
                    msg_data["chart_type"] = matched_q.chart_type or "bar"
                    msg_data["confidence"] = matched_q.confidence
                    msg_data["isError"] = matched_q.status == "error"
                    if matched_q.sql:
                        try:
                            res = execute_query(matched_q.sql)
                            if isinstance(res, list):
                                msg_data["result"] = res
                        except Exception:
                            pass
            formatted_messages.append(msg_data)
            
    return {
        "id": sess.id,
        "title": sess.title,
        "created_at": sess.created_at.isoformat() if sess.created_at else "",
        "messages": formatted_messages
    }

@router.patch("/sessions/{session_id}")
def update_session(session_id: str, req: SessionUpdateRequest, db: Session = Depends(get_db)):
    sess = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    sess.title = req.title.strip() or sess.title
    db.commit()
    return {"status": "success", "id": sess.id, "title": sess.title}

@router.delete("/sessions/{session_id}")
def delete_session(session_id: str, user: Optional[User] = Depends(get_current_user_optional), db: Session = Depends(get_db)):
    query = db.query(ChatSession).filter(ChatSession.id == session_id)
    if user:
        query = query.filter((ChatSession.user_id == user.id) | (ChatSession.user_id == None))
    sess = query.first()
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    db.delete(sess)
    db.commit()
    return {"status": "deleted", "session_id": session_id}

@router.post("/demo-seed")
def seed_demo_data(user: User = Depends(get_current_user_required), db: Session = Depends(get_db)):
    """Seed or refresh analytical records for demo user."""
    seed_starter_analytics(db, user.id)
    return {"status": "success", "message": "Demo analytical workspace records created."}

def seed_starter_analytics(db: Session, user_id: str):
    """Generates starter sessions & queries so the user's dashboard is populated immediately."""
    sess_id = f"sess_{user_id[:8]}_starter"
    existing_sess = db.query(ChatSession).filter(ChatSession.id == sess_id).first()
    if not existing_sess:
        starter_sess = ChatSession(id=sess_id, user_id=user_id, title="E-Commerce Performance Overview")
        db.add(starter_sess)
        db.commit()
        
        # Add messages
        msg1 = ChatMessage(session_id=sess_id, role="user", content="Show total sales by product category")
        msg2 = ChatMessage(session_id=sess_id, role="assistant", content="Here is the breakdown of sales across product categories. Electronics leads with $42,500 in total sales.")
        db.add_all([msg1, msg2])
        db.commit()

    samples = [
        {
            "question": "Show total sales by category",
            "sql": "SELECT c.category_name, SUM(oi.subtotal) AS total_sales FROM categories c JOIN products p ON c.id = p.category_id JOIN order_items oi ON p.id = oi.product_id GROUP BY c.category_name ORDER BY total_sales DESC;",
            "chart_type": "bar",
            "confidence": 0.98,
            "status": "success",
            "is_pinned": 1
        },
        {
            "question": "Which products have the highest profit margins?",
            "sql": "SELECT product_name, price, cost_price, ROUND(((price - cost_price) / price) * 100, 2) AS margin_pct FROM products ORDER BY margin_pct DESC LIMIT 5;",
            "chart_type": "bar",
            "confidence": 0.95,
            "status": "success",
            "is_pinned": 1
        },
        {
            "question": "Show count of orders grouped by status",
            "sql": "SELECT status, COUNT(*) AS count FROM orders GROUP BY status ORDER BY count DESC;",
            "chart_type": "pie",
            "confidence": 0.99,
            "status": "success",
            "is_pinned": 1
        },
        {
            "question": "List top 5 customers by total spending",
            "sql": "SELECT c.first_name, c.last_name, SUM(o.total_amount) AS total_spent FROM customers c JOIN orders o ON c.id = o.customer_id GROUP BY c.id ORDER BY total_spent DESC LIMIT 5;",
            "chart_type": "bar",
            "confidence": 0.96,
            "status": "success",
            "is_pinned": 0
        },
        {
            "question": "Show monthly order count trend over time",
            "sql": "SELECT strftime('%Y-%m', order_date) AS month, COUNT(*) AS order_count FROM orders GROUP BY month ORDER BY month ASC;",
            "chart_type": "line",
            "confidence": 0.92,
            "status": "success",
            "is_pinned": 0
        }
    ]

    for item in samples:
        exists = db.query(UserQuery).filter(UserQuery.user_id == user_id, UserQuery.question == item["question"]).first()
        if not exists:
            uq = UserQuery(
                user_id=user_id,
                session_id=sess_id,
                question=item["question"],
                sql=item["sql"],
                chart_type=item["chart_type"],
                confidence=item["confidence"],
                status=item["status"],
                is_pinned=item["is_pinned"]
            )
            db.add(uq)
    db.commit()
