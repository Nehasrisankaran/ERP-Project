import psycopg2

print("Connecting to postgres to drop schema public...")
conn = psycopg2.connect("dbname=fanam_hrms user=postgres password=postgres host=localhost port=5431")
conn.autocommit = True
cur = conn.cursor()
cur.execute("DROP SCHEMA public CASCADE;")
cur.execute("CREATE SCHEMA public;")
cur.close()
conn.close()
print("Dropped and recreated schema public.")

from app.db.session import engine, Base
from app.models.models import *
print("Creating tables...")
Base.metadata.create_all(bind=engine)
print("Tables created.")
