import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db.system_db import SessionLocal, User

client = TestClient(app)

def test_signup_login_dashboard_flow():
    test_user = "analyst_tester"
    test_email = "analyst_tester@university.edu"
    test_pass = "securePassword123!"

    # Clean up any existing test user
    db = SessionLocal()
    existing = db.query(User).filter((User.username == test_user) | (User.email == test_email)).first()
    if existing:
        db.delete(existing)
        db.commit()
    db.close()

    # 1. Sign up
    signup_res = client.post("/api/auth/signup", json={
        "username": test_user,
        "email": test_email,
        "password": test_pass,
        "role": "Lead Data Analyst"
    })
    assert signup_res.status_code == 200, signup_res.text
    signup_data = signup_res.json()
    assert "token" in signup_data
    assert signup_data["user"]["username"] == test_user
    assert signup_data["user"]["role"] == "Lead Data Analyst"
    token = signup_data["token"]

    # 2. Duplicate signup should fail
    dup_res = client.post("/api/auth/signup", json={
        "username": test_user,
        "email": test_email,
        "password": test_pass
    })
    assert dup_res.status_code == 400

    # 3. Log in with correct credentials
    login_res = client.post("/api/auth/login", json={
        "username_or_email": test_user,
        "password": test_pass
    })
    assert login_res.status_code == 200
    login_data = login_res.json()
    assert login_data["token"] is not None

    # 4. Log in with wrong password should fail
    bad_login = client.post("/api/auth/login", json={
        "username_or_email": test_user,
        "password": "wrongPassword999"
    })
    assert bad_login.status_code == 401

    # 5. Access /api/auth/me
    headers = {"Authorization": f"Bearer {token}"}
    me_res = client.get("/api/auth/me", headers=headers)
    assert me_res.status_code == 200
    assert me_res.json()["user"]["username"] == test_user

    # 6. Access /api/auth/dashboard
    dash_res = client.get("/api/auth/dashboard", headers=headers)
    assert dash_res.status_code == 200
    dash_data = dash_res.json()
    assert "metrics" in dash_data
    assert dash_data["metrics"]["total_queries"] >= 5
    assert len(dash_data["recent_queries"]) >= 5
    assert len(dash_data["pinned_insights"]) >= 1

    # 7. Pin/unpin a query
    first_query_id = dash_data["recent_queries"][0]["id"]
    pin_res = client.post(f"/api/auth/queries/{first_query_id}/pin", headers=headers)
    assert pin_res.status_code == 200
    assert "is_pinned" in pin_res.json()
