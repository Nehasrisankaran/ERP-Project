from sqlalchemy import create_engine, text
engine = create_engine('sqlite:///./workmate.db')
with engine.connect() as conn:
    try:
        conn.execute(text('ALTER TABLE users ADD COLUMN preferences JSON;'))
    except Exception as e:
        print(f'users err: {e}')
    try:
        conn.execute(text('ALTER TABLE organizations ADD COLUMN settings JSON;'))
    except Exception as e:
        print(f'org err: {e}')
    try:
        conn.execute(text('ALTER TABLE tasks ADD COLUMN completed_at DATETIME;'))
    except Exception as e:
        print(f'tasks err: {e}')
    conn.commit()

