from sqlalchemy import text
from app.db.session import SessionLocal

def migrate_pg():
    print("Connecting to PostgreSQL via SessionLocal...")
    db = SessionLocal()
    
    try:
        # Check if column exists in Postgres
        result = db.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='tasks' AND column_name='project_task_number'"))
        exists = result.scalar() is not None
        
        if not exists:
            print("Adding project_task_number column to Postgres tasks table...")
            db.execute(text("ALTER TABLE tasks ADD COLUMN project_task_number INTEGER"))
            db.commit()
        else:
            print("Column project_task_number already exists.")

        print("Backfilling project_task_number...")
        # Get all projects
        projects_res = db.execute(text("SELECT id FROM projects"))
        projects = projects_res.fetchall()
        
        for p in projects:
            project_id = p[0]
            # Fetch tasks for this project ordered by created_at
            tasks_res = db.execute(text(
                "SELECT id FROM tasks WHERE project_id = :pid ORDER BY created_at ASC"
            ), {"pid": project_id})
            tasks = tasks_res.fetchall()
            
            for i, t in enumerate(tasks, start=1):
                task_id = t[0]
                db.execute(text(
                    "UPDATE tasks SET project_task_number = :num WHERE id = :tid"
                ), {"num": i, "tid": task_id})
        
        db.commit()
        print("Migration complete!")
    except Exception as e:
        db.rollback()
        print(f"Error migrating: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    migrate_pg()
