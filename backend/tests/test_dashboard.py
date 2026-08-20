import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.main import app
from app.models.models import Organization, User, Employee, Project, Task
from app.db.session import SessionLocal, engine, Base
import random
from datetime import datetime

# Create tables
Base.metadata.create_all(bind=engine)

@pytest.fixture(scope="module")
def db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture(scope="module")
def client():
    return TestClient(app)

def test_dashboard_isolation_and_roles(client: TestClient, db: Session):
    # 1. Setup Data
    org_a = Organization(name="Org A", slug=f"org-a-{random.randint(1,1000)}")
    org_b = Organization(name="Org B", slug=f"org-b-{random.randint(1,1000)}")
    db.add(org_a)
    db.add(org_b)
    db.commit()
    db.refresh(org_a)
    db.refresh(org_b)

    # Org A Users
    user_a_emp = User(email=f"empA{random.randint(1,1000)}@test.com", hashed_password="pwd", full_name="Emp A", role="employee", organization_id=org_a.id)
    user_a_mgr = User(email=f"mgrA{random.randint(1,1000)}@test.com", hashed_password="pwd", full_name="Mgr A", role="manager", organization_id=org_a.id)
    
    # Org B Users
    user_b_emp = User(email=f"empB{random.randint(1,1000)}@test.com", hashed_password="pwd", full_name="Emp B", role="employee", organization_id=org_b.id)
    
    db.add_all([user_a_emp, user_a_mgr, user_b_emp])
    db.commit()
    db.refresh(user_a_emp)
    db.refresh(user_a_mgr)
    db.refresh(user_b_emp)

    emp_a = Employee(user_id=user_a_emp.id, organization_id=org_a.id)
    mgr_a = Employee(user_id=user_a_mgr.id, organization_id=org_a.id)
    emp_b = Employee(user_id=user_b_emp.id, organization_id=org_b.id)
    
    db.add_all([emp_a, mgr_a, emp_b])
    db.commit()
    db.refresh(emp_a)
    db.refresh(mgr_a)
    db.refresh(emp_b)
    
    # Set manager
    emp_a.reporting_manager_id = mgr_a.id
    db.commit()

    # Projects
    proj_a = Project(name="Project A", organization_id=org_a.id, manager_id=mgr_a.id)
    proj_b = Project(name="Project B", organization_id=org_b.id)
    db.add_all([proj_a, proj_b])
    db.commit()
    db.refresh(proj_a)
    db.refresh(proj_b)

    # Tasks
    task_a = Task(title="Task A", project_id=proj_a.id, assignee_id=emp_a.id, status="not_started", due_date=datetime.utcnow().strftime("%Y-%m-%d"))
    task_b = Task(title="Task B", project_id=proj_b.id, assignee_id=emp_b.id, status="not_started", due_date=datetime.utcnow().strftime("%Y-%m-%d"))
    db.add_all([task_a, task_b])
    db.commit()

    # We mock authentication by overriding the dependency
    from app.core.deps import get_current_active_user
    
    # --- Test Employee A ---
    app.dependency_overrides[get_current_active_user] = lambda: user_a_emp
    res_emp = client.get("/api/v1/dashboard")
    assert res_emp.status_code == 200
    data = res_emp.json()
    assert data["role"] == "employee"
    assert len(data["recent_tasks"]) > 0
    # Isolation test: Task B shouldn't be here
    for t in data["recent_tasks"]:
        assert t["title"] != "Task B"

    # --- Test Manager A ---
    app.dependency_overrides[get_current_active_user] = lambda: user_a_mgr
    res_mgr = client.get("/api/v1/dashboard")
    assert res_mgr.status_code == 200
    data = res_mgr.json()
    # It might resolve as project_manager contextually because Mgr A is manager of Proj A
    assert data["role"] in ["project_manager", "manager"]

    app.dependency_overrides.clear()
