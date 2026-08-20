from sqlalchemy import text
from app.db.session import SessionLocal

def migrate_employees_pg():
    print("Connecting to PostgreSQL via SessionLocal...")
    db = SessionLocal()
    
    try:
        columns = [
            "employee_type VARCHAR(50)",
            "dob VARCHAR(20)",
            "blood_group VARCHAR(10)",
            "personal_email VARCHAR(255)",
            "emergency_contact VARCHAR(20)",
            "permanent_address TEXT",
            "platform_role_mapping JSONB"
        ]
        
        for col in columns:
            col_name = col.split()[0]
            try:
                # Add column in Postgres
                db.execute(text(f"ALTER TABLE employees ADD COLUMN {col}"))
                print(f"Successfully added column {col_name}")
            except Exception as e:
                db.rollback()
                print(f"Skipping {col_name}, might already exist: {e}")

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
    migrate_employees_pg()
