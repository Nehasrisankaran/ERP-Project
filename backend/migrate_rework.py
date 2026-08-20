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

queries = [
    "ALTER TABLE tasks ADD COLUMN rework_count INTEGER DEFAULT 0;",
    "ALTER TABLE tasks ADD COLUMN is_reopened BOOLEAN DEFAULT false;",
    "ALTER TABLE tasks ADD COLUMN reopened_at TIMESTAMP;",
    "ALTER TABLE tasks ADD COLUMN reopened_by INTEGER REFERENCES users(id) ON DELETE SET NULL;",
    "ALTER TABLE tasks ADD COLUMN reopen_reason TEXT;"
]

for q in queries:
    try:
        cur.execute(q)
        print(f"Executed: {q}")
    except Exception as e:
        print(f'err on {q}: {e}')

cur.close()
conn.close()
print("Done")
