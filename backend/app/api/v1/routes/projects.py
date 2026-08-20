from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.db.session import get_db
from app.core.deps import get_current_active_user
from app.models.models import (
    Project, Task, Employee, User, project_members, TaskComment, TaskActivity,
    Milestone, TaskDependency
)
from app.schemas.schemas import (
    ProjectCreate, ProjectUpdate, ProjectRead,
    TaskCreate, TaskUpdate, TaskRead,
    TaskCommentCreate, TaskCommentRead,
    TaskActivityRead, MilestoneCreate, MilestoneUpdate, MilestoneRead,
    TaskDependencyCreate, TaskDependencyRead, TaskScheduleUpdate
)
from app.services.scheduling_service import (
    build_task_read_model, build_milestone_read_model,
    validate_no_dependency_cycle, compute_project_schedule_health
)

router = APIRouter(tags=["projects"])


# ── Helpers ───────────────────────────────────────────────

def enrich_project(project: Project, db: Session) -> ProjectRead:
    task_count = db.query(func.count(Task.id)).filter(Task.project_id == project.id).scalar()
    completed = db.query(func.count(Task.id)).filter(
        Task.project_id == project.id,
        Task.status == "completed"
    ).scalar()
    data = ProjectRead.model_validate(project)
    data.task_count = task_count
    data.completed_task_count = completed
    return data


def enrich_task(task: Task, db: Session) -> TaskRead:
    return build_task_read_model(task, db)


def check_project_access(project: Project, current_user: User):
    """Enforce that Team Leads can only access projects they manage."""
    if current_user.role == "team_lead":
        if not current_user.employee or project.manager_id != current_user.employee.id:
            raise HTTPException(status_code=403, detail="Access denied: You are not the assigned team lead for this project.")



def log_activity(
    db: Session,
    task_id: int,
    actor_id: int,
    event_type: str,
    description: str,
    payload: Optional[dict] = None,
):
    """Append a task activity record."""
    entry = TaskActivity(
        task_id=task_id,
        actor_id=actor_id,
        event_type=event_type,
        description=description,
        payload=payload,
    )
    db.add(entry)


# ── Projects ──────────────────────────────────────────────

@router.get("/organizations/{org_id}/projects", response_model=List[ProjectRead])
def list_projects(org_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    query = db.query(Project).filter(Project.organization_id == org_id)
    
    if current_user.role == "team_lead":
        if not current_user.employee:
            return []
        query = query.filter(Project.manager_id == current_user.employee.id)
        
    projects = query.order_by(Project.created_at.desc()).all()
    return [enrich_project(p, db) for p in projects]


@router.post("/projects", response_model=ProjectRead, status_code=201)
def create_project(
    payload: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    member_ids = payload.member_ids or []
    data = payload.model_dump(exclude={"member_ids"})
    project = Project(**data, created_by_id=current_user.id)
    db.add(project)
    db.flush()
    if member_ids:
        employees = db.query(Employee).filter(Employee.id.in_(member_ids)).all()
        project.members.extend(employees)
    db.commit()
    db.refresh(project)
    return enrich_project(project, db)


@router.get("/projects/{project_id}", response_model=ProjectRead)
def get_project(project_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    check_project_access(project, current_user)
    return enrich_project(project, db)


@router.patch("/projects/{project_id}", response_model=ProjectRead)
def update_project(
    project_id: int,
    payload: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    check_project_access(project, current_user)
    
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(project, field, value)
    db.commit()
    db.refresh(project)
    return enrich_project(project, db)


@router.delete("/projects/{project_id}", status_code=204)
def delete_project(project_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    check_project_access(project, current_user)
    db.delete(project)
    db.commit()


# ── Tasks ─────────────────────────────────────────────────

@router.get("/projects/{project_id}/tasks", response_model=List[TaskRead])
def list_tasks(
    project_id: int,
    status: Optional[str] = Query(None),
    assignee_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    check_project_access(project, current_user)
    
    query = db.query(Task).filter(Task.project_id == project_id, Task.parent_task_id == None)
    if status:
        query = query.filter(Task.status == status)
    if assignee_id:
        query = query.filter(Task.assignee_id == assignee_id)
    tasks = query.order_by(Task.position, Task.created_at).all()
    return [enrich_task(t, db) for t in tasks]


@router.post("/projects/{project_id}/tasks", response_model=TaskRead, status_code=201)
def create_task(
    project_id: int,
    payload: TaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    check_project_access(project, current_user)

    # Validate assignee if provided
    if payload.assignee_id:
        assignee = db.query(Employee).filter(
            Employee.id == payload.assignee_id,
            Employee.organization_id == project.organization_id
        ).first()
        if not assignee:
            raise HTTPException(status_code=400, detail="Assignee does not belong to this organization")

    data = payload.model_dump()
    data["project_id"] = project_id
    data["created_by_id"] = current_user.id

    max_pos = db.query(func.max(Task.position)).filter(
        Task.project_id == project_id,
        Task.status == data.get("status", "not_started")
    ).scalar() or 0
    data["position"] = max_pos + 1

    max_num = db.query(func.max(Task.project_task_number)).filter(Task.project_id == project_id).scalar() or 0
    data["project_task_number"] = max_num + 1

    task = Task(**data)
    db.add(task)
    db.flush()

    # Log creation activity
    log_activity(
        db, task.id, current_user.id,
        "created", f"Created task \"{task.title}\""
    )

    # Log assignment if provided
    if payload.assignee_id and task.assignee:
        log_activity(
            db, task.id, current_user.id,
            "assigned", f"Assigned to {task.assignee.user.full_name if task.assignee and task.assignee.user else 'someone'}",
            {"assignee_id": payload.assignee_id}
        )

    db.commit()
    db.refresh(task)
    return enrich_task(task, db)


@router.get("/tasks/{task_id}", response_model=TaskRead)
def get_task(task_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    check_project_access(task.project, current_user)
    return enrich_task(task, db)


@router.patch("/tasks/{task_id}", response_model=TaskRead)
def update_task(
    task_id: int,
    payload: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    check_project_access(task.project, current_user)

    updates = payload.model_dump(exclude_none=True)

    # ── Check for rework reopen (DONE -> TODO) ─────────────
    if "status" in updates and task.status == "completed" and updates["status"] == "not_started":
        is_project_manager = current_user.employee and task.project.manager_id == current_user.employee.id
        if current_user.role not in ["team_lead", "manager", "admin", "super_admin"] and not is_project_manager:
            raise HTTPException(status_code=403, detail="Only team leads and managers can reopen completed tasks.")
        
        if not payload.reopen_reason or not payload.reopen_reason.strip():
            raise HTTPException(status_code=400, detail="A comment is required when reopening a completed task.")
        
        updates["rework_count"] = task.rework_count + 1
        updates["is_reopened"] = True
        updates["reopened_at"] = datetime.utcnow()
        updates["reopened_by"] = current_user.id
        
        log_activity(
            db, task_id, current_user.id,
            "TASK_REOPENED",
            f"Reopened task: {payload.reopen_reason}",
            {
                "from_status": "completed",
                "to_status": "not_started",
                "comment": payload.reopen_reason,
            }
        )
        
    # If a reopened task reaches DONE again, clear the active flag
    if "status" in updates and updates["status"] == "completed" and getattr(task, "is_reopened", False):
        updates["is_reopened"] = False

    # ── Status change with completed_at lifecycle ──────────
    if "status" in updates and updates["status"] != task.status:
        old_status = task.status
        new_status = updates["status"]

        # Map statuses to human labels
        STATUS_LABELS = {
            "not_started": "To Do", "in_progress": "In Progress",
            "in_review": "In Review", "blocked": "Blocked",
            "completed": "Done", "cancelled": "Cancelled",
        }

        # Avoid duplicate log if we already logged TASK_REOPENED
        if not (old_status == "completed" and new_status == "not_started"):
            log_activity(
                db, task_id, current_user.id,
                "status_changed",
                f"Changed status from {STATUS_LABELS.get(old_status, old_status)} to {STATUS_LABELS.get(new_status, new_status)}",
                {"from": old_status, "to": new_status}
            )

        # Set/clear completed_at
        if new_status == "completed" and task.completed_at is None:
            updates["completed_at"] = datetime.utcnow()
            log_activity(db, task_id, current_user.id, "completed", f"Completed task \"{task.title}\"")
        elif new_status != "completed" and task.completed_at is not None:
            updates["completed_at"] = None
            log_activity(db, task_id, current_user.id, "reopened", f"Reopened task \"{task.title}\"")

    # ── Priority change ────────────────────────────────────
    if "priority" in updates and updates["priority"] != task.priority:
        PRIORITY_LABELS = {"low": "Low", "medium": "Medium", "high": "High", "critical": "Critical"}
        log_activity(
            db, task_id, current_user.id,
            "priority_changed",
            f"Changed priority from {PRIORITY_LABELS.get(task.priority, task.priority)} to {PRIORITY_LABELS.get(updates['priority'], updates['priority'])}",
            {"from": task.priority, "to": updates["priority"]}
        )

    # ── Assignee change ────────────────────────────────────
    if "assignee_id" in updates and updates["assignee_id"] != task.assignee_id:
        new_emp = None
        if updates["assignee_id"]:
            new_emp = db.query(Employee).filter(Employee.id == updates["assignee_id"]).first()
        new_name = new_emp.user.full_name if new_emp and new_emp.user else "Unassigned"
        log_activity(
            db, task_id, current_user.id,
            "assigned",
            f"Assigned to {new_name}",
            {"assignee_id": updates["assignee_id"]}
        )

    # ── Due date change ────────────────────────────────────
    if "due_date" in updates and updates["due_date"] != task.due_date:
        log_activity(
            db, task_id, current_user.id,
            "due_date_changed",
            f"Changed due date to {updates['due_date'] or 'none'}",
            {"from": task.due_date, "to": updates["due_date"]}
        )

    for field, value in updates.items():
        setattr(task, field, value)

    db.commit()
    db.refresh(task)
    return enrich_task(task, db)


@router.delete("/tasks/{task_id}", status_code=204)
def delete_task(task_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    check_project_access(task.project, current_user)
    db.delete(task)
    db.commit()


# ── Subtasks ───────────────────────────────────────────────

@router.get("/tasks/{task_id}/subtasks", response_model=List[TaskRead])
def list_subtasks(task_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    parent = db.query(Task).filter(Task.id == task_id).first()
    if not parent:
        raise HTTPException(status_code=404, detail="Task not found")
    check_project_access(parent.project, current_user)
    subtasks = db.query(Task).filter(Task.parent_task_id == task_id).order_by(Task.position, Task.created_at).all()
    return [enrich_task(t, db) for t in subtasks]


@router.post("/tasks/{task_id}/subtasks", response_model=TaskRead, status_code=201)
def create_subtask(
    task_id: int,
    payload: TaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    parent = db.query(Task).filter(Task.id == task_id).first()
    if not parent:
        raise HTTPException(status_code=404, detail="Parent task not found")
    check_project_access(parent.project, current_user)

    data = payload.model_dump()
    data["project_id"] = parent.project_id
    data["parent_task_id"] = task_id
    data["created_by_id"] = current_user.id
    data["position"] = 0

    max_num = db.query(func.max(Task.project_task_number)).filter(Task.project_id == parent.project_id).scalar() or 0
    data["project_task_number"] = max_num + 1

    task = Task(**data)
    db.add(task)
    db.flush()

    log_activity(db, task.id, current_user.id, "created", f"Created subtask \"{task.title}\"")
    db.commit()
    db.refresh(task)
    return enrich_task(task, db)


# ── Task Activity ──────────────────────────────────────────

@router.get("/tasks/{task_id}/activity", response_model=List[TaskActivityRead])
def get_task_activity(task_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    check_project_access(task.project, current_user)
    
    entries = db.query(TaskActivity).filter(
        TaskActivity.task_id == task_id
    ).order_by(TaskActivity.created_at.desc()).limit(50).all()
    result = []
    for entry in entries:
        actor_name = None
        if entry.actor_id:
            user = db.query(User).filter(User.id == entry.actor_id).first()
            actor_name = user.full_name if user else None
        result.append(TaskActivityRead(
            id=entry.id,
            task_id=entry.task_id,
            actor_id=entry.actor_id,
            actor_name=actor_name,
            event_type=entry.event_type,
            description=entry.description,
            payload=entry.payload,
            created_at=entry.created_at,
        ))
    return result


# ── Task Comments ─────────────────────────────────────────

@router.get("/tasks/{task_id}/comments", response_model=List[TaskCommentRead])
def list_comments(task_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    check_project_access(task.project, current_user)
    
    comments = db.query(TaskComment).filter(TaskComment.task_id == task_id).order_by(TaskComment.created_at).all()
    result = []
    for c in comments:
        data = TaskCommentRead.model_validate(c)
        if c.author_id:
            user = db.query(User).filter(User.id == c.author_id).first()
            data.author_name = user.full_name if user else None
        result.append(data)
    return result


@router.post("/tasks/{task_id}/comments", response_model=TaskCommentRead, status_code=201)
def add_comment(
    task_id: int,
    payload: TaskCommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    check_project_access(task.project, current_user)

    comment = TaskComment(task_id=task_id, author_id=current_user.id, content=payload.content)
    db.add(comment)
    db.flush()

    log_activity(
        db, task_id, current_user.id,
        "comment_added", f"Added a comment",
        {"comment_id": comment.id}
    )

    db.commit()
    db.refresh(comment)
    data = TaskCommentRead.model_validate(comment)
    data.author_name = current_user.full_name
    return data


# ── Dashboard stats ───────────────────────────────────────

@router.get("/organizations/{org_id}/dashboard")
def get_dashboard_stats(
    org_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    project_query = db.query(Project.id).filter(Project.organization_id == org_id)
    if current_user.role == "team_lead":
        if not current_user.employee:
            project_query = db.query(Project.id).filter(False) # empty
        else:
            project_query = project_query.filter(Project.manager_id == current_user.employee.id)

    total_projects = db.query(func.count(Project.id)).filter(Project.id.in_(project_query)).scalar()
    active_projects = db.query(func.count(Project.id)).filter(
        Project.id.in_(project_query), Project.status == "active"
    ).scalar()
    total_tasks = db.query(func.count(Task.id)).filter(Task.project_id.in_(project_query)).scalar()
    completed_tasks = db.query(func.count(Task.id)).filter(
        Task.project_id.in_(project_query), Task.status == "completed"
    ).scalar()
    in_progress_tasks = db.query(func.count(Task.id)).filter(
        Task.project_id.in_(project_query), Task.status == "in_progress"
    ).scalar()
    overdue_tasks = db.query(func.count(Task.id)).filter(
        Task.project_id.in_(project_query),
        Task.status.notin_(["completed", "cancelled"]),
        Task.due_date != None,
    ).scalar()

    return {
        "total_projects": total_projects,
        "active_projects": active_projects,
        "total_tasks": total_tasks,
        "completed_tasks": completed_tasks,
        "in_progress_tasks": in_progress_tasks,
        "overdue_tasks": overdue_tasks,
        "completion_rate": round((completed_tasks / total_tasks * 100) if total_tasks else 0, 1),
    }


@router.get('/organizations/{org_id}/my-tasks', response_model=List[TaskRead])
def my_tasks(
    org_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    employee = db.query(Employee).filter(
        Employee.organization_id == org_id, Employee.user_id == current_user.id
    ).first()
    if not employee:
        return []

    tasks = db.query(Task).join(Project).filter(
        Project.organization_id == org_id,
        Task.parent_task_id == None,
        (Task.assignee_id == employee.id) | (Task.created_by_id == current_user.id)
    ).order_by(Task.due_date.asc().nulls_last(), Task.created_at.desc()).all()

    return [enrich_task(t, db) for t in tasks]


# ── Project Scheduling & Projections (Calendar, Timeline, Gantt) ─────

@router.get("/projects/{project_id}/schedule-health")
def get_project_schedule_health(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    check_project_access(project, current_user)
    return compute_project_schedule_health(project_id, db)


@router.get("/projects/{project_id}/calendar")
def get_project_calendar(
    project_id: int,
    assignee_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    check_project_access(project, current_user)

    query = db.query(Task).filter(Task.project_id == project_id)
    if assignee_id:
        query = query.filter(Task.assignee_id == assignee_id)
    if status:
        query = query.filter(Task.status == status)
    if priority:
        query = query.filter(Task.priority == priority)

    all_tasks = query.all()
    scheduled = [enrich_task(t, db) for t in all_tasks if t.start_date or t.due_date]
    unscheduled = [enrich_task(t, db) for t in all_tasks if not t.start_date and not t.due_date]

    milestones = db.query(Milestone).filter(Milestone.project_id == project_id).all()
    milestone_reads = [build_milestone_read_model(m, db) for m in milestones]

    return {
        "scheduled_tasks": scheduled,
        "unscheduled_tasks": unscheduled,
        "milestones": milestone_reads,
        "health_summary": compute_project_schedule_health(project_id, db),
    }


@router.get("/projects/{project_id}/timeline")
def get_project_timeline(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    check_project_access(project, current_user)

    tasks = db.query(Task).filter(Task.project_id == project_id).order_by(Task.start_date.asc().nulls_last(), Task.due_date.asc().nulls_last()).all()
    milestones = db.query(Milestone).filter(Milestone.project_id == project_id).order_by(Milestone.target_date.asc()).all()
    deps = db.query(TaskDependency).filter(TaskDependency.project_id == project_id).all()

    dep_reads = []
    for d in deps:
        dep_reads.append(TaskDependencyRead(
            id=d.id,
            project_id=d.project_id,
            source_task_id=d.source_task_id,
            target_task_id=d.target_task_id,
            dependency_type=d.dependency_type.value if hasattr(d.dependency_type, "value") else str(d.dependency_type),
            source_task_title=d.source_task.title if d.source_task else None,
            target_task_title=d.target_task.title if d.target_task else None,
            created_at=d.created_at,
        ))

    return {
        "tasks": [enrich_task(t, db) for t in tasks],
        "milestones": [build_milestone_read_model(m, db) for m in milestones],
        "dependencies": dep_reads,
        "health_summary": compute_project_schedule_health(project_id, db),
    }


@router.get("/projects/{project_id}/gantt")
def get_project_gantt(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    return get_project_timeline(project_id, db=db, current_user=current_user)


# ── Milestones ─────────────────────────────────────────────

@router.get("/projects/{project_id}/milestones", response_model=List[MilestoneRead])
def list_milestones(project_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    check_project_access(project, current_user)
    
    milestones = db.query(Milestone).filter(Milestone.project_id == project_id).order_by(Milestone.target_date.asc()).all()
    return [build_milestone_read_model(m, db) for m in milestones]


@router.post("/projects/{project_id}/milestones", response_model=MilestoneRead, status_code=201)
def create_milestone(
    project_id: int,
    payload: MilestoneCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    check_project_access(project, current_user)

    m = Milestone(
        project_id=project_id,
        name=payload.name,
        description=payload.description,
        target_date=payload.target_date,
        owner_id=payload.owner_id,
    )
    db.add(m)
    db.commit()
    db.refresh(m)
    return build_milestone_read_model(m, db)


@router.patch("/milestones/{milestone_id}", response_model=MilestoneRead)
def update_milestone(
    milestone_id: int,
    payload: MilestoneUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    m = db.query(Milestone).filter(Milestone.id == milestone_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Milestone not found")
    check_project_access(m.project, current_user)
    for field, val in payload.model_dump(exclude_none=True).items():
        setattr(m, field, val)
    db.commit()
    db.refresh(m)
    return build_milestone_read_model(m, db)


@router.delete("/milestones/{milestone_id}", status_code=204)
def delete_milestone(milestone_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    m = db.query(Milestone).filter(Milestone.id == milestone_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Milestone not found")
    check_project_access(m.project, current_user)
    db.delete(m)
    db.commit()


# ── Task Dependencies & Schedule Updating ──────────────────

@router.patch("/tasks/{task_id}/schedule", response_model=TaskRead)
def update_task_schedule(
    task_id: int,
    payload: TaskScheduleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    check_project_access(task.project, current_user)

    old_start = task.start_date
    old_due = task.due_date

    if payload.start_date is not None:
        task.start_date = payload.start_date
    if payload.due_date is not None:
        task.due_date = payload.due_date
    if payload.estimated_hours is not None:
        task.estimated_hours = payload.estimated_hours

    # Validate dates start_date <= due_date if both exist
    if task.start_date and task.due_date and task.start_date > task.due_date:
        raise HTTPException(status_code=400, detail="Start date cannot be after due date.")

    if old_due != task.due_date or old_start != task.start_date:
        log_activity(
            db, task_id, current_user.id,
            "schedule_changed",
            f"Rescheduled: {task.start_date or 'N/A'} → {task.due_date or 'N/A'}",
            {"old_start": old_start, "old_due": old_due, "new_start": task.start_date, "new_due": task.due_date}
        )

    db.commit()
    db.refresh(task)
    return enrich_task(task, db)


@router.get("/tasks/{task_id}/dependencies", response_model=List[TaskDependencyRead])
def list_task_dependencies(task_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    check_project_access(task.project, current_user)

    deps = db.query(TaskDependency).filter(
        (TaskDependency.source_task_id == task_id) | (TaskDependency.target_task_id == task_id)
    ).all()

    result = []
    for d in deps:
        result.append(TaskDependencyRead(
            id=d.id,
            project_id=d.project_id,
            source_task_id=d.source_task_id,
            target_task_id=d.target_task_id,
            dependency_type=d.dependency_type.value if hasattr(d.dependency_type, "value") else str(d.dependency_type),
            source_task_title=d.source_task.title if d.source_task else None,
            target_task_title=d.target_task.title if d.target_task else None,
            created_at=d.created_at,
        ))
    return result


@router.post("/tasks/{task_id}/dependencies", response_model=TaskDependencyRead, status_code=201)
def add_task_dependency(
    task_id: int,
    payload: TaskDependencyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    check_project_access(task.project, current_user)

    # Validate cycle
    validate_no_dependency_cycle(db, task.project_id, payload.source_task_id, payload.target_task_id)

    # Check existing
    existing = db.query(TaskDependency).filter(
        TaskDependency.source_task_id == payload.source_task_id,
        TaskDependency.target_task_id == payload.target_task_id
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Dependency relationship already exists.")

    dep = TaskDependency(
        project_id=task.project_id,
        source_task_id=payload.source_task_id,
        target_task_id=payload.target_task_id,
        dependency_type=payload.dependency_type,
        created_by_id=current_user.id,
    )
    db.add(dep)
    db.flush()

    src_task = db.query(Task).filter(Task.id == payload.source_task_id).first()
    tgt_task = db.query(Task).filter(Task.id == payload.target_task_id).first()
    log_activity(
        db, payload.target_task_id, current_user.id,
        "dependency_added",
        f"Added dependency: '{src_task.title if src_task else 'Task'}' blocks '{tgt_task.title if tgt_task else 'Task'}'"
    )

    db.commit()
    db.refresh(dep)

    return TaskDependencyRead(
        id=dep.id,
        project_id=dep.project_id,
        source_task_id=dep.source_task_id,
        target_task_id=dep.target_task_id,
        dependency_type=dep.dependency_type.value if hasattr(dep.dependency_type, "value") else str(dep.dependency_type),
        source_task_title=dep.source_task.title if dep.source_task else None,
        target_task_title=dep.target_task.title if dep.target_task else None,
        created_at=dep.created_at,
    )


@router.delete("/dependencies/{dependency_id}", status_code=204)
def delete_task_dependency(dependency_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    dep = db.query(TaskDependency).filter(TaskDependency.id == dependency_id).first()
    if not dep:
        raise HTTPException(status_code=404, detail="Dependency not found")
    
    project = db.query(Project).filter(Project.id == dep.project_id).first()
    if project:
        check_project_access(project, current_user)
        
    db.delete(dep)
    db.commit()

