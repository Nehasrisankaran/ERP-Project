from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.deps import get_current_active_user
from app.models.models import Organization, Employee, Team, Project, User, Department, TaskStatus
from app.schemas.schemas import (
    OrganizationCreate, OrganizationRead,
    DepartmentCreate, DepartmentRead,
    EmployeeCreate, EmployeeRead,
    TeamCreate, TeamRead,
)

router = APIRouter(tags=["organization"])


# ── Organization ──────────────────────────────────────────
@router.post("/organizations", response_model=OrganizationRead, status_code=201)
def create_organization(payload: OrganizationCreate, db: Session = Depends(get_db)):
    existing = db.query(Organization).filter(Organization.slug == payload.slug).first()
    if existing:
        raise HTTPException(status_code=400, detail="Organization slug already exists")
    org = Organization(**payload.model_dump())
    db.add(org)
    db.commit()
    db.refresh(org)
    return org


@router.get("/organizations/{org_id}", response_model=OrganizationRead)
def get_organization(org_id: int, db: Session = Depends(get_db), _=Depends(get_current_active_user)):
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org


# ── Departments ───────────────────────────────────────────
@router.get("/organizations/{org_id}/departments", response_model=List[DepartmentRead])
def list_departments(org_id: int, db: Session = Depends(get_db), _=Depends(get_current_active_user)):
    return db.query(Department).filter(Department.organization_id == org_id).all()


@router.post("/departments", response_model=DepartmentRead, status_code=201)
def create_department(payload: DepartmentCreate, db: Session = Depends(get_db), _=Depends(get_current_active_user)):
    dept = Department(**payload.model_dump())
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return dept


def _build_employee_read(emp: Employee, db: Session) -> EmployeeRead:
    from datetime import datetime
    today_str = datetime.utcnow().strftime("%Y-%m-%d")

    data = EmployeeRead.model_validate(emp)
    if emp.user:
        data.full_name = emp.user.full_name
        data.email = emp.user.email
        data.role = emp.user.role.value if hasattr(emp.user.role, 'value') else str(emp.user.role)
    
    data.avatar_url = emp.avatar_url
    data.department_name = emp.department.name if emp.department else None

    # Manager
    if emp.reporting_manager_id:
        mgr = db.query(Employee).filter(Employee.id == emp.reporting_manager_id).first()
        if mgr and mgr.user:
            data.manager_id = mgr.id
            data.manager_name = mgr.user.full_name

    # Teams
    data.teams = [{"id": t.id, "name": t.name} for t in emp.teams]

    # Active Projects count
    data.active_projects_count = len(emp.projects)

    # Tasks & Workload calculation
    assigned_tasks = emp.assigned_tasks or []
    active_tasks = [t for t in assigned_tasks if t.status != TaskStatus.completed and t.status != TaskStatus.cancelled]
    completed_tasks = [t for t in assigned_tasks if t.status == TaskStatus.completed]
    overdue_tasks = [t for t in active_tasks if t.due_date and t.due_date < today_str]

    data.active_tasks_count = len(active_tasks)
    data.completed_tasks_count = len(completed_tasks)
    data.overdue_tasks_count = len(overdue_tasks)

    # Workload capacity (assuming 40h standard weekly capacity)
    tot_estimated = sum(t.estimated_hours or 4.0 for t in active_tasks)
    data.estimated_hours = float(tot_estimated)
    
    capacity = 40.0
    percentage = int(min(round((tot_estimated / capacity) * 100), 200))
    data.workload_percentage = percentage

    if percentage > 100:
        data.workload_status = "Overloaded"
    elif percentage >= 75:
        data.workload_status = "High"
    elif percentage >= 30:
        data.workload_status = "Healthy"
    else:
        data.workload_status = "Underutilized"

    return data


# ── Employees ─────────────────────────────────────────────
@router.get("/organizations/{org_id}/employees", response_model=List[EmployeeRead])
def list_employees(org_id: int, db: Session = Depends(get_db), _=Depends(get_current_active_user)):
    employees = db.query(Employee).filter(Employee.organization_id == org_id).all()
    return [_build_employee_read(emp, db) for emp in employees]


@router.post("/employees", response_model=EmployeeRead, status_code=201)
def create_employee(payload: EmployeeCreate, db: Session = Depends(get_db), _=Depends(get_current_active_user)):
    emp = Employee(**payload.model_dump())
    db.add(emp)
    db.commit()
    db.refresh(emp)
    return _build_employee_read(emp, db)


@router.get("/employees/{emp_id}", response_model=EmployeeRead)
def get_employee(emp_id: int, db: Session = Depends(get_db), _=Depends(get_current_active_user)):
    emp = db.query(Employee).filter(Employee.id == emp_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    return _build_employee_read(emp, db)


# ── Teams ─────────────────────────────────────────────────
def _build_team_read(team: Team) -> TeamRead:
    members_list = []
    for emp in team.members:
        members_list.append({
            "id": emp.id,
            "full_name": emp.user.full_name if emp.user else "Employee",
            "email": emp.user.email if emp.user else None,
            "designation": emp.designation,
            "avatar_url": emp.avatar_url,
            "status": emp.status.value if hasattr(emp.status, "value") else str(emp.status) if emp.status else "active"
        })
    return TeamRead(
        id=team.id,
        name=team.name,
        description=team.description,
        organization_id=team.organization_id,
        department_id=team.department_id,
        created_at=team.created_at,
        member_count=len(members_list),
        members=members_list,
    )


@router.get("/organizations/{org_id}/teams", response_model=List[TeamRead])
def list_teams(org_id: int, db: Session = Depends(get_db), _=Depends(get_current_active_user)):
    teams = db.query(Team).filter(Team.organization_id == org_id).all()
    return [_build_team_read(t) for t in teams]


@router.post("/teams", response_model=TeamRead, status_code=201)
def create_team(payload: TeamCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    if current_user.role not in ("admin", "super_admin", "manager"):
        raise HTTPException(status_code=403, detail="Not authorized to create teams")
    team = Team(**payload.model_dump())
    db.add(team)
    db.commit()
    db.refresh(team)
    return _build_team_read(team)


@router.delete("/teams/{team_id}")
def delete_team(team_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    if current_user.role not in ("admin", "super_admin", "manager"):
        raise HTTPException(status_code=403, detail="Not authorized to delete teams")
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    db.delete(team)
    db.commit()
    return {"message": "Team deleted successfully"}


@router.post("/teams/{team_id}/members", response_model=TeamRead)
def add_team_member(team_id: int, payload: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    if current_user.role not in ("admin", "super_admin", "manager"):
        raise HTTPException(status_code=403, detail="Not authorized to modify team members")
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    emp_id = payload.get("employee_id")
    if not emp_id:
        raise HTTPException(status_code=400, detail="employee_id required")
    emp = db.query(Employee).filter(Employee.id == emp_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    if emp not in team.members:
        team.members.append(emp)
        db.commit()
        db.refresh(team)
    return _build_team_read(team)


@router.delete("/teams/{team_id}/members/{emp_id}", response_model=TeamRead)
def remove_team_member(team_id: int, emp_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    if current_user.role not in ("admin", "super_admin", "manager"):
        raise HTTPException(status_code=403, detail="Not authorized to modify team members")
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    emp = db.query(Employee).filter(Employee.id == emp_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    if emp in team.members:
        team.members.remove(emp)
        db.commit()
        db.refresh(team)
    return _build_team_read(team)


@router.patch('/organizations/{org_id}', response_model=OrganizationRead)
def update_organization(org_id: int, payload: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail='Organization not found')
    if 'name' in payload:
        org.name = payload['name']
    if 'industry' in payload:
        org.industry = payload['industry']
    if 'website' in payload:
        org.website = payload['website']
    if 'settings' in payload:
        current_settings = org.settings or {}
        current_settings.update(payload['settings'])
        org.settings = current_settings
    db.commit()
    db.refresh(org)
    return org

