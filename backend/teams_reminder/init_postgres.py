import os
import sys
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+psycopg2://postgres:postgres@localhost:5431/fanam_teams_reminder")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5431")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")
DB_NAME = os.getenv("DB_NAME", "")

def init_postgres_db():
    print("Parsing database configuration...")
    url = DATABASE_URL
    if url and "postgresql+psycopg2://" in url:
        url = url.replace("postgresql+psycopg2://", "postgresql://")
        
    db_name = DB_NAME
    if url:
        import urllib.parse as urlparse
        try:
            parsed = urlparse.urlparse(url)
            db_name = parsed.path.lstrip('/')
        except Exception:
            pass
    if not db_name:
        db_name = "fanam_teams_reminder"
        
    print(f"Target Database: '{db_name}'")
    
    # 1. Connect to postgres default DB and create target database if not exists
    temp_conn = None
    try:
        if url:
            import urllib.parse as urlparse
            parsed = urlparse.urlparse(url)
            temp_url = urlparse.urlunparse((
                parsed.scheme,
                parsed.netloc,
                "/postgres",
                parsed.params,
                parsed.query,
                parsed.fragment
            ))
            temp_conn = psycopg2.connect(temp_url)
        else:
            temp_conn = psycopg2.connect(
                host=DB_HOST,
                port=DB_PORT,
                user=DB_USER,
                password=DB_PASSWORD,
                database="postgres"
            )
        temp_conn.autocommit = True
        cur = temp_conn.cursor()
        cur.execute(f"SELECT 1 FROM pg_database WHERE datname = '{db_name}'")
        exists = cur.fetchone()
        if not exists:
            cur.execute(f"CREATE DATABASE {db_name}")
            print(f"Created database '{db_name}' successfully!")
        else:
            print(f"Database '{db_name}' already exists.")
        cur.close()
    except Exception as e:
        print(f"Checking/creating database '{db_name}' returned: {e}")
    finally:
        if temp_conn:
            temp_conn.close()

    # 2. Connect to the target database and create tables
    print(f"Connecting to database '{db_name}' to create tables...")
    conn = None
    try:
        if url:
            conn = psycopg2.connect(url)
        else:
            conn = psycopg2.connect(
                host=DB_HOST,
                port=DB_PORT,
                user=DB_USER,
                password=DB_PASSWORD,
                database=db_name
            )
        conn.autocommit = True
        cur = conn.cursor()
        
        # Activity Log table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS activity_log (
                id SERIAL PRIMARY KEY,
                timestamp VARCHAR(100) NOT NULL,
                event VARCHAR(255) NOT NULL,
                detail TEXT DEFAULT ''
            )
        """)
        print("Table 'activity_log' ready.")
        
        # Reminder History table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS reminder_history (
                id SERIAL PRIMARY KEY,
                sent_at VARCHAR(100) NOT NULL,
                assignee VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL,
                task_count INTEGER NOT NULL,
                status VARCHAR(50) NOT NULL,
                subject TEXT DEFAULT '',
                error_detail TEXT DEFAULT '',
                chat_id VARCHAR(255) DEFAULT '',
                message_id VARCHAR(255) DEFAULT ''
            )
        """)
        print("Table 'reminder_history' ready.")
        
        # Pending Teams Replies table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS pending_teams_replies (
                id SERIAL PRIMARY KEY,
                sent_at VARCHAR(100) NOT NULL,
                assignee VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL,
                chat_id VARCHAR(255) NOT NULL,
                message_id VARCHAR(255) NOT NULL,
                recipient_user_id VARCHAR(255) NOT NULL,
                sender_user_id VARCHAR(255) NOT NULL,
                task_json TEXT NOT NULL,
                status VARCHAR(50) NOT NULL DEFAULT 'pending',
                reply_text TEXT DEFAULT '',
                replied_at VARCHAR(100) DEFAULT '',
                sharepoint_written INTEGER DEFAULT 0,
                reminder_type VARCHAR(50) DEFAULT 'morning'
            )
        """)
        print("Table 'pending_teams_replies' ready.")
        
        # Notified New Tasks table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS notified_new_tasks (
                id SERIAL PRIMARY KEY,
                project VARCHAR(255) NOT NULL,
                task_name VARCHAR(255) NOT NULL,
                assignee VARCHAR(255) NOT NULL,
                email VARCHAR(255),
                notified_at VARCHAR(100) NOT NULL,
                description TEXT DEFAULT ''
            )
        """)
        print("Table 'notified_new_tasks' ready.")
        
        # Completed Tasks History table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS completed_tasks_history (
                id SERIAL PRIMARY KEY,
                project VARCHAR(255) NOT NULL,
                task_name VARCHAR(255) NOT NULL,
                assignee VARCHAR(255) NOT NULL,
                description TEXT DEFAULT '',
                completed_at VARCHAR(100) NOT NULL
            )
        """)
        print("Table 'completed_tasks_history' ready.")

        # Weekly Targets table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS weekly_targets (
                id SERIAL PRIMARY KEY,
                project VARCHAR(255) NOT NULL,
                week_start_date DATE NOT NULL,
                target_milestone TEXT NOT NULL,
                deadline DATE,
                dependencies TEXT DEFAULT '',
                achieved BOOLEAN DEFAULT FALSE,
                achievement_notes TEXT DEFAULT '',
                risks_faced TEXT DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        print("Table 'weekly_targets' ready.")

        # Employee Skills table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS employee_skills (
                id SERIAL PRIMARY KEY,
                employee_name VARCHAR(255) UNIQUE NOT NULL,
                strengths TEXT DEFAULT '',
                weaknesses TEXT DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        print("Table 'employee_skills' ready.")
        
        cur.close()
        print("All tables successfully initialized!")
    except Exception as e:
        print(f"Error creating tables: {e}")
        sys.exit(1)
    finally:
        if conn:
            conn.close()

if __name__ == '__main__':
    init_postgres_db()
