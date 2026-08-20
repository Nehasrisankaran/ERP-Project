from app.db.session import SessionLocal
from app.models.models import User, Employee

def list_users():
    db = SessionLocal()
    users = db.query(User).all()
    for u in users:
        print(f"ID: {u.id}, Email: {u.email}, Name: {u.full_name}")
    db.close()

if __name__ == "__main__":
    list_users()
