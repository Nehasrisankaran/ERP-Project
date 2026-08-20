from fastapi import APIRouter
from app.api.v1.routes import auth, organization, projects, people, departments, dashboard

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth.router)
api_router.include_router(organization.router)
api_router.include_router(projects.router)
api_router.include_router(people.router)
api_router.include_router(departments.router, prefix="/departments", tags=["departments"])
api_router.include_router(dashboard.router)
