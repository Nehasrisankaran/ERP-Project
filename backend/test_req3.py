import requests
from app.db.session import SessionLocal
from app.models.models import User
from app.core.security import create_access_token
from datetime import timedelta
import sys

db = SessionLocal()
email = "alex.chen@acme.com"
u = db.query(User).filter(User.email == email).first()
if not u:
    print("User not found")
    sys.exit(1)

access_token = create_access_token(
    data={"sub": str(u.id)}, expires_delta=timedelta(minutes=30)
)
headers = {"Authorization": f"Bearer {access_token}"}
print(f"Requesting for {email}...")
resp = requests.get("http://localhost:8000/api/v1/projects/1/tasks", headers=headers, timeout=5)
print(f"Status: {resp.status_code}")
if resp.status_code == 500:
    print(resp.text)
