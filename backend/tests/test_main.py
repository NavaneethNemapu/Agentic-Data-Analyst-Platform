from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_read_root():
    response = client.get("/")
    assert response.status_code == 200
    assert "Welcome to Agentic AI Data Analyst Assistant" in response.json()["message"]

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

def test_system_info():
    response = client.get("/api/info")
    assert response.status_code == 200
    data = response.json()
    assert "db" in data
    assert "available_providers" in data

def test_dataset_upload_and_reset():
    csv_content = b"user_name,age,country\nAlice,30,Canada\nBob,25,USA"
    response = client.post(
        "/api/upload-dataset",
        files={"file": ("test_users.csv", csv_content, "text/csv")}
    )
    assert response.status_code == 200
    assert response.json()["status"] == "success"
    assert "test_users" in response.json()["db"]["tables"]

    reset_resp = client.post("/api/reset-dataset")
    assert reset_resp.status_code == 200
    assert reset_resp.json()["status"] == "success"

