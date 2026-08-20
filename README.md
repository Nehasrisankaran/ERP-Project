# WORKMATE

## Requirements

- Node.js 18+
- Python 3.11+
- Docker Desktop

---

## 1. Database

```bash
docker-compose up -d
```

---

## 2. Backend

```bash
cd backend

python -m venv venv
venv\Scripts\activate

pip install -r requirements.txt

python migrate.py

venv\Scripts\uvicorn app.main:app --reload --port 8000
```

Runs at → http://localhost:8000/docs

---

## 3. Frontend

```bash
cd frontend

npm install

npm run dev
```

Runs at → http://localhost:5173

---

## Seed Data (optional)

```bash
cd backend
venv\Scripts\python seed.py
venv\Scripts\python seed_teams.py
```
