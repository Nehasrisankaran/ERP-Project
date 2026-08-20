import sqlite3

def migrate():
    conn = sqlite3.connect("workmate.db")
    cursor = conn.cursor()
    
    # Check if column exists
    cursor.execute("PRAGMA table_info(tasks)")
    columns = [info[1] for info in cursor.fetchall()]
    
    if "project_task_number" not in columns:
        print("Adding project_task_number column...")
        cursor.execute("ALTER TABLE tasks ADD COLUMN project_task_number INTEGER")
    else:
        print("Column project_task_number already exists.")

    # Backfill missing values
    print("Backfilling project_task_number...")
    cursor.execute("SELECT id FROM projects")
    projects = cursor.fetchall()
    
    for (project_id,) in projects:
        cursor.execute("SELECT id FROM tasks WHERE project_id = ? ORDER BY created_at ASC", (project_id,))
        tasks = cursor.fetchall()
        for i, (task_id,) in enumerate(tasks, start=1):
            cursor.execute("UPDATE tasks SET project_task_number = ? WHERE id = ?", (i, task_id))
            
    conn.commit()
    print("Migration complete!")
    conn.close()

if __name__ == "__main__":
    migrate()
