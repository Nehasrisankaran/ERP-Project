import requests
from app.db.session import SessionLocal
from app.models.models import User
from app.core.security import create_access_token
from datetime import timedelta

db = SessionLocal()
users = db.query(User).all()
for u in users:
    access_token = create_access_token(
        data={"sub": str(u.id)}, expires_delta=timedelta(minutes=30)
    )
    headers = {"Authorization": f"Bearer {access_token}"}
    resp = requests.get("http://localhost:8000/api/v1/projects/1/tasks", headers=headers)
    print(f"User: {u.role} ({u.email}) -> Status: {resp.status_code}")
    if resp.status_code == 500:
        print(resp.text)
