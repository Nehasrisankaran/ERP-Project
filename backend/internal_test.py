from fastapi.testclient import TestClient
from app.main import app
from app.schemas.schemas import TaskCreate
from sqlalchemy import create_engine
from app.db.session import SessionLocal

client = TestClient(app)
res = client.post("/api/v1/auth/login", json={"email": "admin@acme.com", "password": "admin123"})
tok = res.json()["access_token"]
me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {tok}"}).json()
proj = client.post("/api/v1/projects", json={"name": "Test1", "organization_id": me["organization_id"]}, headers={"Authorization": f"Bearer {tok}"}).json()
try:
    res = client.post(f"/api/v1/projects/{proj['id']}/tasks", json={"title": "Test1", "status": "not_started"}, headers={"Authorization": f"Bearer {tok}"})
    print(res.status_code, res.text)
except Exception as e:
    import traceback
    traceback.print_exc()
