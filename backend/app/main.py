from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.db.session import Base, engine

# Create tables on startup (use Alembic in production)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="WORKMATE API",
    description="The operating system for modern companies.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from teams_reminder.teams_api import router as teams_router

app.include_router(api_router)
app.include_router(teams_router, prefix="/api/teams", tags=["teams"])



@app.get("/health")
def health():
    return {"status": "ok", "service": "workmate-api"}
