"""
People module routes.

Provides rich employee profile data: summary metrics, tasks,
projects, teams, activity, status management (suspend/activate/deactivate).
"""
from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_

from app.db.session import get_db
from app.core.deps import get_current_active_user
from app.models.models import (
    Employee, User, Task, Project, Team, Department,
    TaskStatus, Priority, EmploymentStatus, project_members, team_members
)
from app.schemas.schemas import (
    EmployeeRead, TaskRead, ProjectRead, TeamRead,
)
from app.api.v1.routes.organization import _build_employee_read
from app.api.v1.routes.projects import enrich_task, enrich_project

router = APIRouter(prefix="/employees", tags=["people"])


# ── Helpers ───────────────────────────────────────────────

def _require_employee(emp_id: int, db: Session) -> Employee:
    emp = db.query(Employee).filter(Employee.id == emp_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    return emp


def _today() -> str:
    return datetime.utcnow().strftime("%Y-%m-%d")


# ── Employee summary / profile ─────────────────────────────

@router.get("/{emp_id}", response_model=EmployeeRead)
def get_employee_profile(
    emp_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_active_user),
):
    emp = _require_employee(emp_id, db)
    return _build_employee_read(emp, db)


# ── Employee tasks ─────────────────────────────────────────

@router.get("/{emp_id}/tasks", response_model=List[TaskRead])
def get_employee_tasks(
    emp_id: int,
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    project_id: Optional[int] = Query(None),
    overdue_only: bool = Query(False),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_active_user),
):
    emp = _require_employee(emp_id, db)
    today = _today()

    query = db.query(Task).filter(
        Task.assignee_id == emp.id,
        Task.parent_task_id.is_(None),
    )

    if status:
        query = query.filter(Task.status == status)
    if priority:
        query = query.filter(Task.priority == priority)
    if project_id:
        query = query.filter(Task.project_id == project_id)
    if overdue_only:
        query = query.filter(
            Task.due_date.isnot(None),
            Task.due_date < today,
            Task.status.notin_(["completed", "cancelled"]),
        )

    tasks = query.order_by(Task.due_date.asc().nulls_last(), Task.created_at.desc()).all()
    return [enrich_task(t, db) for t in tasks]


# ── Employee projects ──────────────────────────────────────

@router.get("/{emp_id}/projects", response_model=List[ProjectRead])
def get_employee_projects(
    emp_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_active_user),
):
    emp = _require_employee(emp_id, db)
    return [enrich_project(p, db) for p in emp.projects]


# ── Employee teams ─────────────────────────────────────────

@router.get("/{emp_id}/teams")
def get_employee_teams(
    emp_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_active_user),
):
    emp = _require_employee(emp_id, db)
    result = []
    for team in emp.teams:
        members_list = []
        for m in team.members:
            members_list.append({
                "id": m.id,
                "full_name": m.user.full_name if m.user else "—",
                "email": m.user.email if m.user else None,
                "designation": m.designation,
                "avatar_url": m.avatar_url,
                "status": m.status.value if hasattr(m.status, "value") else str(m.status),
            })
        lead = None
        if team.lead_id:
            lead_emp = db.query(Employee).filter(Employee.id == team.lead_id).first()
            if lead_emp and lead_emp.user:
                lead = {"id": lead_emp.id, "full_name": lead_emp.user.full_name}
        result.append({
            "id": team.id,
            "name": team.name,
            "description": team.description,
            "organization_id": team.organization_id,
            "department_id": team.department_id,
            "member_count": len(members_list),
            "members": members_list,
            "lead": lead,
            "created_at": team.created_at.isoformat(),
        })
    return result


# ── Employee direct reports ────────────────────────────────

@router.get("/{emp_id}/direct-reports")
def get_direct_reports(
    emp_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_active_user),
):
    reports = db.query(Employee).filter(Employee.reporting_manager_id == emp_id).all()
    return [_build_employee_read(r, db) for r in reports]


# ── Employee activity ──────────────────────────────────────

@router.get("/{emp_id}/activity")
def get_employee_activity(
    emp_id: int,
    limit: int = Query(30, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_active_user),
):
    """
    Returns recent task-level activity for the employee.
    Pulls from task_activity where actor maps to this employee's user.
    """
    from app.models.models import TaskActivity

    emp = _require_employee(emp_id, db)
    if not emp.user:
        return []

    entries = (
        db.query(TaskActivity)
        .filter(TaskActivity.actor_id == emp.user_id)
        .order_by(TaskActivity.created_at.desc())
        .limit(limit)
        .all()
    )

    result = []
    for entry in entries:
        task = db.query(Task).filter(Task.id == entry.task_id).first()
        project_name = task.project.name if task and task.project else None
        result.append({
            "id": entry.id,
            "task_id": entry.task_id,
            "task_title": task.title if task else None,
            "project_name": project_name,
            "event_type": entry.event_type,
            "description": entry.description,
            "payload": entry.payload,
            "created_at": entry.created_at.isoformat(),
        })
    return result


# ── Status management ─────────────────────────────────────

@router.post("/{emp_id}/suspend", response_model=EmployeeRead)
def suspend_employee(
    emp_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    if current_user.role not in ("admin", "super_admin", "manager"):
        raise HTTPException(status_code=403, detail="Not authorized to suspend employees")
    emp = _require_employee(emp_id, db)
    emp.status = EmploymentStatus.terminated  # using 'terminated' as suspended
    # Deactivate user login
    if emp.user:
        emp.user.is_active = False
    db.commit()
    db.refresh(emp)
    return _build_employee_read(emp, db)


@router.post("/{emp_id}/activate", response_model=EmployeeRead)
def activate_employee(
    emp_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    if current_user.role not in ("admin", "super_admin", "manager"):
        raise HTTPException(status_code=403, detail="Not authorized to activate employees")
    emp = _require_employee(emp_id, db)
    emp.status = EmploymentStatus.active
    if emp.user:
        emp.user.is_active = True
    db.commit()
    db.refresh(emp)
    return _build_employee_read(emp, db)


@router.post("/{emp_id}/deactivate", response_model=EmployeeRead)
def deactivate_employee(
    emp_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    if current_user.role not in ("admin", "super_admin"):
        raise HTTPException(status_code=403, detail="Not authorized to deactivate employees")
    emp = _require_employee(emp_id, db)
    emp.status = EmploymentStatus.terminated
    if emp.user:
        emp.user.is_active = False
    db.commit()
    db.refresh(emp)
    return _build_employee_read(emp, db)


# ── PATCH employee info ────────────────────────────────────

@router.patch("/{emp_id}", response_model=EmployeeRead)
def update_employee(
    emp_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    emp = _require_employee(emp_id, db)

    # Fields on Employee model
    emp_fields = {"designation", "phone", "location", "department_id",
                  "employee_code", "date_joined", "reporting_manager_id", "avatar_url",
                  "employee_type", "dob", "blood_group", "personal_email",
                  "emergency_contact", "permanent_address", "platform_role_mapping"}
    # Fields on User model (name changes)
    user_fields = {"full_name"}

    for key, value in payload.items():
        if key in emp_fields:
            setattr(emp, key, value)
        elif key in user_fields and emp.user:
            setattr(emp.user, key, value)

    db.commit()
    db.refresh(emp)
    return _build_employee_read(emp, db)


# ── Transfer work ─────────────────────────────────────────

@router.post("/{emp_id}/transfer-work")
def transfer_work(
    emp_id: int,
    payload: dict,  # { "to_employee_id": int }
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    if current_user.role not in ("admin", "super_admin", "manager"):
        raise HTTPException(status_code=403, detail="Not authorized")

    from_emp = _require_employee(emp_id, db)
    to_emp_id = payload.get("to_employee_id")
    if not to_emp_id:
        raise HTTPException(status_code=400, detail="to_employee_id required")

    to_emp = _require_employee(to_emp_id, db)

    # Transfer active tasks
    active_tasks = db.query(Task).filter(
        Task.assignee_id == from_emp.id,
        Task.status.notin_(["completed", "cancelled"]),
    ).all()

    for task in active_tasks:
        task.assignee_id = to_emp.id

    db.commit()
    return {"transferred": len(active_tasks), "to_employee_id": to_emp_id}
