from app.database import SessionLocal
from app.models.models import Task
from app.services.scheduling_service import build_task_read_model
import traceback

db = SessionLocal()
try:
    task = db.query(Task).first()
    if task:
        print(f"Task found: {task.id}")
        read_model = build_task_read_model(task, db)
        print("Success!")
    else:
        print("No task found")
except Exception as e:
    print("ERROR OCCURRED:")
    traceback.print_exc()
finally:
    db.close()
