from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel

from app.models.models import (
    ProjectStatus, ProjectWorkMode, Priority,
    TaskStatus, EmploymentStatus
)


# ── Organization ──────────────────────────────────────────
class OrganizationCreate(BaseModel):
    name: str
    slug: str
    industry: Optional[str] = None
    website: Optional[str] = None


class OrganizationRead(BaseModel):
    settings: Optional[dict] = None
    id: int
    name: str
    slug: str
    industry: Optional[str]
    website: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ── Department ────────────────────────────────────────────
class DepartmentCreate(BaseModel):
    name: str
    code: Optional[str] = None
    description: Optional[str] = None
    organization_id: int
    head_employee_id: Optional[int] = None
    status: Optional[str] = 'active'

class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    head_employee_id: Optional[int] = None
    status: Optional[str] = None

class DepartmentRead(BaseModel):
    id: int
    name: str
    code: Optional[str] = None
    description: Optional[str]
    organization_id: int
    head_employee_id: Optional[int] = None
    status: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── Employee ──────────────────────────────────────────────
class EmployeeCreate(BaseModel):
    user_id: int
    organization_id: int
    department_id: Optional[int] = None
    employee_code: Optional[str] = None
    designation: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    date_joined: Optional[str] = None
    employee_type: Optional[str] = None
    dob: Optional[str] = None
    blood_group: Optional[str] = None
    personal_email: Optional[str] = None
    emergency_contact: Optional[str] = None
    permanent_address: Optional[str] = None
    platform_role_mapping: Optional[dict] = None


class TeamSummaryRead(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True

class EmployeeRead(BaseModel):
    id: int
    user_id: int
    organization_id: int
    department_id: Optional[int]
    employee_code: Optional[str]
    designation: Optional[str]
    phone: Optional[str]
    location: Optional[str]
    status: EmploymentStatus
    date_joined: Optional[str]
    employee_type: Optional[str]
    dob: Optional[str]
    blood_group: Optional[str]
    personal_email: Optional[str]
    emergency_contact: Optional[str]
    permanent_address: Optional[str]
    platform_role_mapping: Optional[dict]
    created_at: datetime
    # Nested & Calculated fields
    full_name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    avatar_url: Optional[str] = None
    department_name: Optional[str] = None
    manager_id: Optional[int] = None
    manager_name: Optional[str] = None
    teams: List[TeamSummaryRead] = []
    active_tasks_count: int = 0
    completed_tasks_count: int = 0
    overdue_tasks_count: int = 0
    active_projects_count: int = 0
    estimated_hours: float = 0.0
    workload_percentage: int = 0
    workload_status: str = "Healthy"

    class Config:
        from_attributes = True


# ── Team ──────────────────────────────────────────────────
class TeamMemberRead(BaseModel):
    id: int
    full_name: Optional[str] = None
    email: Optional[str] = None
    designation: Optional[str] = None
    avatar_url: Optional[str] = None
    status: Optional[str] = None

class TeamCreate(BaseModel):
    name: str
    description: Optional[str] = None
    organization_id: int
    department_id: Optional[int] = None


class TeamRead(BaseModel):
    id: int
    name: str
    description: Optional[str]
    organization_id: int
    department_id: Optional[int]
    created_at: datetime
    member_count: int = 0
    members: List[TeamMemberRead] = []

    class Config:
        from_attributes = True


# ── Project ───────────────────────────────────────────────
class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    organization_id: int
    priority: Priority = Priority.medium
    work_mode: ProjectWorkMode = ProjectWorkMode.standard
    start_date: Optional[str] = None
    target_date: Optional[str] = None
    manager_id: Optional[int] = None
    member_ids: Optional[List[int]] = []


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[ProjectStatus] = None
    priority: Optional[Priority] = None
    work_mode: Optional[ProjectWorkMode] = None
    start_date: Optional[str] = None
    target_date: Optional[str] = None
    manager_id: Optional[int] = None


class ProjectRead(BaseModel):
    id: int
    name: str
    description: Optional[str]
    organization_id: int
    status: ProjectStatus
    priority: Priority
    work_mode: ProjectWorkMode
    start_date: Optional[str]
    target_date: Optional[str]
    manager_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    task_count: Optional[int] = 0
    completed_task_count: Optional[int] = 0

    class Config:
        from_attributes = True


# ── Milestone ────────────────────────────────────────────
class MilestoneCreate(BaseModel):
    name: str
    description: Optional[str] = None
    target_date: str
    owner_id: Optional[int] = None

class MilestoneUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    target_date: Optional[str] = None
    status: Optional[str] = None
    owner_id: Optional[int] = None

class MilestoneRead(BaseModel):
    id: int
    project_id: int
    name: str
    description: Optional[str] = None
    target_date: str
    status: str
    owner_id: Optional[int] = None
    owner_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    total_tasks_count: int = 0
    completed_tasks_count: int = 0
    progress_percentage: int = 0

    class Config:
        from_attributes = True


# ── Task Dependency ──────────────────────────────────────
class TaskDependencyCreate(BaseModel):
    source_task_id: int
    target_task_id: int
    dependency_type: str = "blocks"

class TaskDependencyRead(BaseModel):
    id: int
    project_id: int
    source_task_id: int
    target_task_id: int
    dependency_type: str
    source_task_title: Optional[str] = None
    target_task_title: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class TaskScheduleUpdate(BaseModel):
    start_date: Optional[str] = None
    due_date: Optional[str] = None
    estimated_hours: Optional[float] = None


# ── Task ──────────────────────────────────────────────────
class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    project_id: Optional[int] = None   # injected from URL path in route
    status: TaskStatus = TaskStatus.not_started
    priority: Priority = Priority.medium
    assignee_id: Optional[int] = None
    parent_task_id: Optional[int] = None
    milestone_id: Optional[int] = None
    start_date: Optional[str] = None
    due_date: Optional[str] = None
    estimated_hours: Optional[float] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TaskStatus] = None
    priority: Optional[Priority] = None
    assignee_id: Optional[int] = None
    parent_task_id: Optional[int] = None
    milestone_id: Optional[int] = None
    start_date: Optional[str] = None
    due_date: Optional[str] = None
    estimated_hours: Optional[float] = None
    position: Optional[int] = None
    completed_at: Optional[datetime] = None
    reopen_reason: Optional[str] = None


class AssigneeInfo(BaseModel):
    id: int
    full_name: str
    email: str
    avatar_url: Optional[str]

    class Config:
        from_attributes = True


class TaskRead(BaseModel):
    id: int
    title: str
    description: Optional[str]
    project_id: int
    project_task_number: Optional[int] = None
    status: TaskStatus
    priority: Priority
    assignee_id: Optional[int]
    parent_task_id: Optional[int]
    milestone_id: Optional[int] = None
    milestone_name: Optional[str] = None
    start_date: Optional[str]
    due_date: Optional[str]
    estimated_hours: Optional[float]
    position: int
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    rework_count: int = 0
    is_reopened: bool = False
    reopened_at: Optional[datetime] = None
    reopened_by: Optional[int] = None
    reopen_reason: Optional[str] = None
    comment_count: Optional[int] = 0
    subtask_count: Optional[int] = 0
    completed_subtask_count: Optional[int] = 0
    assignee_name: Optional[str] = None
    assignee_avatar: Optional[str] = None
    project_name: Optional[str] = None
    project_manager_user_id: Optional[int] = None
    # Scheduling & ETA metadata
    eta_status: str = "on_track"
    eta_date: Optional[str] = None
    is_overdue: bool = False
    blocked_by_task_ids: List[int] = []
    blocking_task_ids: List[int] = []

    class Config:
        from_attributes = True



# ── Task Comment ─────────────────────────────────────────
class TaskCommentCreate(BaseModel):
    content: str


class TaskCommentRead(BaseModel):
    id: int
    task_id: int
    author_id: int
    content: str
    created_at: datetime
    author_name: Optional[str] = None

    class Config:
        from_attributes = True


# ── Task Activity ─────────────────────────────────────────
class TaskActivityRead(BaseModel):
    id: int
    task_id: int
    actor_id: int
    actor_name: Optional[str] = None
    event_type: str
    description: str
    payload: Optional[dict] = None
    created_at: datetime

    class Config:
        from_attributes = True
