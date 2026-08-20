from fastapi.testclient import TestClient
from app.main import app
from app.db.session import SessionLocal
from app.models.models import User
from app.core.security import create_access_token
from datetime import timedelta
import traceback

client = TestClient(app)
db = SessionLocal()

users = db.query(User).all()
for u in users:
    access_token = create_access_token(
        data={"sub": str(u.id)}, expires_delta=timedelta(minutes=30)
    )
    headers = {"Authorization": f"Bearer {access_token}"}
    try:
        response = client.get("/api/v1/projects/1/tasks", headers=headers)
        print(f"User: {u.role} ({u.email}) -> Status: {response.status_code}")
        if response.status_code == 500:
            print("Response:", response.text)
    except Exception as e:
        print(f"User: {u.email} crashed!")
        traceback.print_exc()
