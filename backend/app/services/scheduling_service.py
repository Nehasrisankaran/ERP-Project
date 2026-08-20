from datetime import datetime, date
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.models import (
    Task, TaskStatus, Milestone, MilestoneStatus,
    TaskDependency, DependencyType, ETAStatus
)
from app.schemas.schemas import TaskRead, MilestoneRead


def compute_task_eta_and_schedule(task: Task, db: Session) -> Dict[str, Any]:
    today_str = date.today().strftime("%Y-%m-%d")
    
    # Dependencies where task is target (blocked by source tasks)
    blocked_by_deps = db.query(TaskDependency).filter(
        TaskDependency.target_task_id == task.id
    ).all()
    blocked_by_ids = [dep.source_task_id for dep in blocked_by_deps]

    # Dependencies where task is source (blocks target tasks)
    blocking_deps = db.query(TaskDependency).filter(
        TaskDependency.source_task_id == task.id
    ).all()
    blocking_ids = [dep.target_task_id for dep in blocking_deps]

    is_completed = task.status == TaskStatus.completed
    is_overdue = False
    if task.due_date and not is_completed:
        is_overdue = today_str > task.due_date

    eta_date = task.due_date or task.start_date or today_str
    has_active_blocker = False

    # Check source tasks for blocking impact
    if blocked_by_ids and not is_completed:
        source_tasks = db.query(Task).filter(Task.id.in_(blocked_by_ids)).all()
        for src in source_tasks:
            if src.status != TaskStatus.completed:
                has_active_blocker = True
                if src.due_date and eta_date and src.due_date > eta_date:
                    eta_date = src.due_date

    # Determine ETA status
    if is_completed:
        eta_status = ETAStatus.completed.value
    elif task.status == TaskStatus.blocked or has_active_blocker:
        eta_status = ETAStatus.blocked.value
    elif is_overdue or (task.due_date and eta_date > task.due_date):
        eta_status = ETAStatus.delayed.value
    elif task.due_date and task.due_date <= today_str and task.status == TaskStatus.not_started:
        eta_status = ETAStatus.at_risk.value
    else:
        eta_status = ETAStatus.on_track.value

    return {
        "eta_status": eta_status,
        "eta_date": eta_date,
        "is_overdue": is_overdue,
        "blocked_by_task_ids": blocked_by_ids,
        "blocking_task_ids": blocking_ids,
    }


def build_task_read_model(task: Task, db: Session) -> TaskRead:
    sched = compute_task_eta_and_schedule(task, db)
    
    comment_count = len(task.comments) if task.comments else 0
    subtasks = task.subtasks or []
    subtask_count = len(subtasks)
    completed_subtask_count = sum(1 for s in subtasks if s.status == TaskStatus.completed)

    assignee_name = task.assignee.user.full_name if task.assignee and task.assignee.user else None
    assignee_avatar = task.assignee.avatar_url if task.assignee else None
    project_name = task.project.name if task.project else None
    project_manager_user_id = task.project.manager.user_id if task.project and task.project.manager else None
    milestone_name = task.milestone.name if task.milestone else None

    return TaskRead(
        id=task.id,
        title=task.title,
        description=task.description,
        project_id=task.project_id,
        project_task_number=task.project_task_number,
        status=task.status,
        priority=task.priority,
        assignee_id=task.assignee_id,
        parent_task_id=task.parent_task_id,
        milestone_id=task.milestone_id,
        milestone_name=milestone_name,
        start_date=task.start_date,
        due_date=task.due_date,
        estimated_hours=task.estimated_hours,
        position=task.position,
        completed_at=task.completed_at,
        created_at=task.created_at,
        updated_at=task.updated_at,
        rework_count=task.rework_count,
        is_reopened=task.is_reopened,
        reopened_at=task.reopened_at,
        reopened_by=task.reopened_by,
        reopen_reason=task.reopen_reason,
        comment_count=comment_count,
        subtask_count=subtask_count,
        completed_subtask_count=completed_subtask_count,
        assignee_name=assignee_name,
        assignee_avatar=assignee_avatar,
        project_name=project_name,
        project_manager_user_id=project_manager_user_id,
        eta_status=sched["eta_status"],
        eta_date=sched["eta_date"],
        is_overdue=sched["is_overdue"],
        blocked_by_task_ids=sched["blocked_by_task_ids"],
        blocking_task_ids=sched["blocking_task_ids"],
    )


def validate_no_dependency_cycle(db: Session, project_id: int, source_task_id: int, target_task_id: int):
    if source_task_id == target_task_id:
        raise HTTPException(status_code=400, detail="A task cannot depend on itself.")
    
    # BFS to detect if target_task_id can reach source_task_id following 'blocks' dependencies
    visited = set()
    queue = [target_task_id]
    
    while queue:
        curr = queue.pop(0)
        if curr == source_task_id:
            raise HTTPException(
                status_code=400,
                detail="Dependency cycle detected! Adding this dependency would create a circular loop."
            )
        visited.add(curr)
        # Find all tasks that `curr` blocks
        outgoing_deps = db.query(TaskDependency).filter(
            TaskDependency.project_id == project_id,
            TaskDependency.source_task_id == curr
        ).all()
        for dep in outgoing_deps:
            if dep.target_task_id not in visited:
                queue.append(dep.target_task_id)


def build_milestone_read_model(milestone: Milestone, db: Session) -> MilestoneRead:
    tasks = milestone.tasks or []
    total = len(tasks)
    completed = sum(1 for t in tasks if t.status == TaskStatus.completed)
    percentage = int((completed / total) * 100) if total > 0 else 0
    owner_name = milestone.owner.user.full_name if milestone.owner and milestone.owner.user else None

    return MilestoneRead(
        id=milestone.id,
        project_id=milestone.project_id,
        name=milestone.name,
        description=milestone.description,
        target_date=milestone.target_date,
        status=milestone.status.value if hasattr(milestone.status, "value") else str(milestone.status),
        owner_id=milestone.owner_id,
        owner_name=owner_name,
        created_at=milestone.created_at,
        updated_at=milestone.updated_at,
        total_tasks_count=total,
        completed_tasks_count=completed,
        progress_percentage=percentage,
    )


def compute_project_schedule_health(project_id: int, db: Session) -> Dict[str, Any]:
    tasks = db.query(Task).filter(Task.project_id == project_id).all()
    milestones = db.query(Milestone).filter(Milestone.project_id == project_id).order_by(Milestone.target_date.asc()).all()

    total_tasks = len(tasks)
    completed_tasks = sum(1 for t in tasks if t.status == TaskStatus.completed)
    overall_progress = int((completed_tasks / total_tasks) * 100) if total_tasks > 0 else 0

    overdue_count = 0
    at_risk_count = 0
    delayed_count = 0
    blocked_count = 0

    for t in tasks:
        sched = compute_task_eta_and_schedule(t, db)
        if sched["is_overdue"]:
            overdue_count += 1
        if sched["eta_status"] == ETAStatus.delayed.value:
            delayed_count += 1
        elif sched["eta_status"] == ETAStatus.at_risk.value:
            at_risk_count += 1
        elif sched["eta_status"] == ETAStatus.blocked.value:
            blocked_count += 1

    health_status = "On Track"
    if delayed_count > 0 or overdue_count > 0:
        health_status = "Delayed"
    elif at_risk_count > 0 or blocked_count > 0:
        health_status = "At Risk"

    # Find next upcoming milestone
    today_str = date.today().strftime("%Y-%m-%d")
    next_milestone = None
    for m in milestones:
        if m.target_date >= today_str and m.status != MilestoneStatus.completed:
            next_milestone = build_milestone_read_model(m, db)
            break

    return {
        "health_status": health_status,
        "total_tasks": total_tasks,
        "completed_tasks": completed_tasks,
        "overall_progress": overall_progress,
        "overdue_count": overdue_count,
        "delayed_count": delayed_count,
        "at_risk_count": at_risk_count,
        "blocked_count": blocked_count,
        "next_milestone": next_milestone,
        "milestones_count": len(milestones),
    }
