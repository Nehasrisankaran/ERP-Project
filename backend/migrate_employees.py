from sqlalchemy import create_engine, text

engine = create_engine('sqlite:///./workmate.db')

with engine.connect() as conn:
    columns = [
        "employee_type VARCHAR(50)",
        "dob VARCHAR(20)",
        "blood_group VARCHAR(10)",
        "personal_email VARCHAR(255)",
        "emergency_contact VARCHAR(20)",
        "permanent_address TEXT",
        "platform_role_mapping JSON"
    ]
    
    for col in columns:
        try:
            conn.execute(text(f'ALTER TABLE employees ADD COLUMN {col};'))
            print(f'Successfully added column: {col}')
        except Exception as e:
            print(f'Error adding column {col}: {e}')
            
    conn.commit()
