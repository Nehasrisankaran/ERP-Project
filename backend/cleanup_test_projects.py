import psycopg2
from dotenv import load_dotenv
import os

load_dotenv()

conn = psycopg2.connect(
    dbname=os.getenv("DB_NAME", "fanam_hrms"),
    user=os.getenv("DB_USER", "postgres"),
    password=os.getenv("DB_PASSWORD", "devildevil8210"),
    host=os.getenv("DB_HOST", "localhost"),
    port=os.getenv("DB_PORT", "5432")
)
conn.autocommit = True
cur = conn.cursor()

# Find project IDs with names starting with 'Test Rework Project', 'Test Error Debug', 'Test1'
test_names = ('Test Rework Project', 'Test Error Debug', 'Test1')
cur.execute("SELECT id, name FROM projects WHERE name IN %s OR name LIKE 'Test Rework%%';", (test_names,))
projects = cur.fetchall()

print(f"Found {len(projects)} test projects.")

for p_id, p_name in projects:
    print(f"Deleting project: {p_name} (ID: {p_id})")
    
    # Due to foreign keys, we might need to delete tasks, subtasks, activities, comments, dependencies first
    # Or just rely on ON DELETE CASCADE if it is set up. Let's delete manually to be safe.
    
    cur.execute("SELECT id FROM tasks WHERE project_id = %s;", (p_id,))
    task_ids = [row[0] for row in cur.fetchall()]
    
    if task_ids:
        # Dependencies
        cur.execute("DELETE FROM task_dependencies WHERE source_task_id = ANY(%s) OR target_task_id = ANY(%s);", (task_ids, task_ids))
        
        # Comments
        cur.execute("DELETE FROM task_comments WHERE task_id = ANY(%s);", (task_ids,))
        
        # Activity
        cur.execute("DELETE FROM task_activity WHERE task_id = ANY(%s);", (task_ids,))
        
        # Subtasks are also tasks, but let's assume they are covered if they share the project_id
        # Delete tasks themselves
        cur.execute("DELETE FROM tasks WHERE id = ANY(%s);", (task_ids,))
        print(f"  Deleted {len(task_ids)} tasks.")
    
    # Delete milestones
    cur.execute("DELETE FROM milestones WHERE project_id = %s;", (p_id,))
    
    # Finally, delete project
    cur.execute("DELETE FROM projects WHERE id = %s;", (p_id,))
    print(f"  Deleted project {p_id}")

cur.close()
conn.close()
print("Cleanup complete.")
