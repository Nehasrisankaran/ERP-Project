import enum
import uuid
from datetime import datetime
from typing import Optional, List

from sqlalchemy import (
    Boolean, Column, DateTime, Enum, ForeignKey, JSON,
    Integer, String, Text, Table, UniqueConstraint
)
from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID

from app.db.session import Base


# ────────────────────────────────────────────────
# ENUMS
# ────────────────────────────────────────────────

class DepartmentStatus(str, enum.Enum):
    active = 'active'
    inactive = 'inactive'

class UserRole(str, enum.Enum):
    super_admin = "super_admin"
    admin = "admin"
    manager = "manager"
    team_lead = "team_lead"
    employee = "employee"
    hr = "hr"
    intern = "intern"


class EmploymentStatus(str, enum.Enum):
    active = "active"
    on_leave = "on_leave"
    terminated = "terminated"


class ProjectStatus(str, enum.Enum):
    planning = "planning"
    active = "active"
    on_hold = "on_hold"
    completed = "completed"
    cancelled = "cancelled"


class ProjectWorkMode(str, enum.Enum):
    standard = "standard"
    milestone = "milestone"
    sprint = "sprint"
    milestone_sprint = "milestone_sprint"


class Priority(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class TaskStatus(str, enum.Enum):
    not_started = "not_started"
    in_progress = "in_progress"
    in_review = "in_review"
    blocked = "blocked"
    completed = "completed"
    cancelled = "cancelled"


class MilestoneStatus(str, enum.Enum):
    upcoming = "upcoming"
    in_progress = "in_progress"
    completed = "completed"
    delayed = "delayed"


class DependencyType(str, enum.Enum):
    blocks = "blocks"
    blocked_by = "blocked_by"
    relates_to = "relates_to"


class ETAStatus(str, enum.Enum):
    on_track = "on_track"
    at_risk = "at_risk"
    delayed = "delayed"
    completed = "completed"
    blocked = "blocked"



# ────────────────────────────────────────────────
# ASSOCIATION TABLES
# ────────────────────────────────────────────────

team_members = Table(
    "team_members",
    Base.metadata,
    Column("team_id", Integer, ForeignKey("teams.id", ondelete="CASCADE"), primary_key=True),
    Column("employee_id", Integer, ForeignKey("employees.id", ondelete="CASCADE"), primary_key=True),
)

project_members = Table(
    "project_members",
    Base.metadata,
    Column("project_id", Integer, ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True),
    Column("employee_id", Integer, ForeignKey("employees.id", ondelete="CASCADE"), primary_key=True),
    Column("role", String(64), nullable=True),
)

task_watchers = Table(
    "task_watchers",
    Base.metadata,
    Column("task_id", Integer, ForeignKey("tasks.id", ondelete="CASCADE"), primary_key=True),
    Column("employee_id", Integer, ForeignKey("employees.id", ondelete="CASCADE"), primary_key=True),
)

task_collaborators = Table(
    "task_collaborators",
    Base.metadata,
    Column("task_id", Integer, ForeignKey("tasks.id", ondelete="CASCADE"), primary_key=True),
    Column("employee_id", Integer, ForeignKey("employees.id", ondelete="CASCADE"), primary_key=True),
)


# ────────────────────────────────────────────────
# MODELS
# ────────────────────────────────────────────────

class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    logo_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    website: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    industry: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    settings: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    departments: Mapped[List["Department"]] = relationship(back_populates="organization")
    teams: Mapped[List["Team"]] = relationship(back_populates="organization")
    employees: Mapped[List["Employee"]] = relationship(back_populates="organization")
    projects: Mapped[List["Project"]] = relationship(back_populates="organization")
    users: Mapped[List["User"]] = relationship(back_populates="organization")


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.employee)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    organization_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("organizations.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_login: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    preferences: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    organization: Mapped[Optional["Organization"]] = relationship(back_populates="users")
    employee: Mapped[Optional["Employee"]] = relationship(back_populates="user", uselist=False)


class Department(Base):
    __tablename__ = 'departments'

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    organization_id: Mapped[int] = mapped_column(Integer, ForeignKey('organizations.id', ondelete='CASCADE'))
    head_employee_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey('employees.id', ondelete='SET NULL'), nullable=True)
    status: Mapped[DepartmentStatus] = mapped_column(Enum(DepartmentStatus), default=DepartmentStatus.active)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    organization: Mapped['Organization'] = relationship(back_populates='departments')
    employees: Mapped[List['Employee']] = relationship(
        'Employee',
        back_populates='department',
        primaryjoin='Department.id == Employee.department_id',
        foreign_keys='Employee.department_id'
    )
    head_employee: Mapped[Optional['Employee']] = relationship(
        'Employee',
        foreign_keys=[head_employee_id]
    )
    teams: Mapped[List['Team']] = relationship(back_populates='department')


class Employee(Base):
    __tablename__ = "employees"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    organization_id: Mapped[int] = mapped_column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"))
    department_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("departments.id"), nullable=True)
    employee_code: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    designation: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    location: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    reporting_manager_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("employees.id"), nullable=True)
    status: Mapped[EmploymentStatus] = mapped_column(Enum(EmploymentStatus), default=EmploymentStatus.active)
    date_joined: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    employee_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    dob: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    blood_group: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    personal_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    emergency_contact: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    permanent_address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    platform_role_mapping: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="employee")
    organization: Mapped["Organization"] = relationship(back_populates="employees")
    department: Mapped[Optional["Department"]] = relationship(
        "Department", foreign_keys=[department_id], back_populates="employees"
    )
    teams: Mapped[List["Team"]] = relationship(secondary=team_members, back_populates="members")
    projects: Mapped[List["Project"]] = relationship(secondary=project_members, back_populates="members")
    assigned_tasks: Mapped[List["Task"]] = relationship(
        "Task", foreign_keys="Task.assignee_id", back_populates="assignee"
    )


class Team(Base):
    __tablename__ = "teams"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    organization_id: Mapped[int] = mapped_column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"))
    department_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("departments.id"), nullable=True)
    lead_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("employees.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    organization: Mapped["Organization"] = relationship(back_populates="teams")
    department: Mapped[Optional["Department"]] = relationship(back_populates="teams")
    members: Mapped[List["Employee"]] = relationship(secondary=team_members, back_populates="teams")


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    organization_id: Mapped[int] = mapped_column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"))
    status: Mapped[ProjectStatus] = mapped_column(Enum(ProjectStatus), default=ProjectStatus.planning)
    priority: Mapped[Priority] = mapped_column(Enum(Priority), default=Priority.medium)
    work_mode: Mapped[ProjectWorkMode] = mapped_column(Enum(ProjectWorkMode), default=ProjectWorkMode.standard)
    manager_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("employees.id"), nullable=True)
    start_date: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    target_date: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    created_by_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    organization: Mapped["Organization"] = relationship(back_populates="projects")
    manager: Mapped[Optional["Employee"]] = relationship(foreign_keys=[manager_id])
    members: Mapped[List["Employee"]] = relationship(secondary=project_members, back_populates="projects")
    tasks: Mapped[List["Task"]] = relationship("Task", back_populates="project", cascade="all, delete-orphan")
    milestones: Mapped[List["Milestone"]] = relationship("Milestone", back_populates="project", cascade="all, delete-orphan")


class Milestone(Base):
    __tablename__ = "milestones"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(Integer, ForeignKey("projects.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    target_date: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[MilestoneStatus] = mapped_column(Enum(MilestoneStatus), default=MilestoneStatus.upcoming)
    owner_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("employees.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project: Mapped["Project"] = relationship(back_populates="milestones")
    owner: Mapped[Optional["Employee"]] = relationship()
    tasks: Mapped[List["Task"]] = relationship("Task", back_populates="milestone")


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    project_id: Mapped[int] = mapped_column(Integer, ForeignKey("projects.id", ondelete="CASCADE"))
    project_task_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    status: Mapped[TaskStatus] = mapped_column(Enum(TaskStatus), default=TaskStatus.not_started)
    priority: Mapped[Priority] = mapped_column(Enum(Priority), default=Priority.medium)
    assignee_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("employees.id"), nullable=True)
    parent_task_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("tasks.id"), nullable=True)
    milestone_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("milestones.id", ondelete="SET NULL"), nullable=True)
    sprint_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    start_date: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    due_date: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    estimated_hours: Mapped[Optional[float]] = mapped_column(nullable=True)
    position: Mapped[int] = mapped_column(Integer, default=0)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_by_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Rework tracking
    rework_count: Mapped[int] = mapped_column(Integer, default=0)
    is_reopened: Mapped[bool] = mapped_column(Boolean, default=False)
    reopened_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    reopened_by: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reopen_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    project: Mapped["Project"] = relationship(back_populates="tasks")
    assignee: Mapped[Optional["Employee"]] = relationship(
        "Employee", foreign_keys=[assignee_id], back_populates="assigned_tasks"
    )
    subtasks: Mapped[List["Task"]] = relationship(
        "Task", foreign_keys=[parent_task_id], back_populates="parent_task"
    )
    parent_task: Mapped[Optional["Task"]] = relationship(
        "Task", foreign_keys=[parent_task_id], back_populates="subtasks", remote_side=[id]
    )
    milestone: Mapped[Optional["Milestone"]] = relationship("Milestone", back_populates="tasks")
    watchers: Mapped[List["Employee"]] = relationship(secondary=task_watchers)
    collaborators: Mapped[List["Employee"]] = relationship(secondary=task_collaborators)
    comments: Mapped[List["TaskComment"]] = relationship(back_populates="task", cascade="all, delete-orphan")
    activity: Mapped[List["TaskActivity"]] = relationship(
        back_populates="task", cascade="all, delete-orphan"
    )
    blocking_dependencies: Mapped[List["TaskDependency"]] = relationship(
        "TaskDependency", foreign_keys="TaskDependency.source_task_id", back_populates="source_task", cascade="all, delete-orphan"
    )
    blocked_dependencies: Mapped[List["TaskDependency"]] = relationship(
        "TaskDependency", foreign_keys="TaskDependency.target_task_id", back_populates="target_task", cascade="all, delete-orphan"
    )


class TaskDependency(Base):
    __tablename__ = "task_dependencies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(Integer, ForeignKey("projects.id", ondelete="CASCADE"))
    source_task_id: Mapped[int] = mapped_column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"))
    target_task_id: Mapped[int] = mapped_column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"))
    dependency_type: Mapped[DependencyType] = mapped_column(Enum(DependencyType), default=DependencyType.blocks)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    created_by_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)

    source_task: Mapped["Task"] = relationship("Task", foreign_keys=[source_task_id], back_populates="blocking_dependencies")
    target_task: Mapped["Task"] = relationship("Task", foreign_keys=[target_task_id], back_populates="blocked_dependencies")



class TaskComment(Base):
    __tablename__ = "task_comments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    task_id: Mapped[int] = mapped_column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"))
    author_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"))
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    task: Mapped["Task"] = relationship(back_populates="comments")


class TaskActivity(Base):
    """Append-only activity log for task lifecycle events."""
    __tablename__ = "task_activity"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    task_id: Mapped[int] = mapped_column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"))
    actor_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"))
    # e.g. "created", "status_changed", "assigned", "priority_changed", "completed", "reopened"
    event_type: Mapped[str] = mapped_column(String(64), nullable=False)
    # Human-readable: "Changed status from In Progress to Done"
    description: Mapped[str] = mapped_column(Text, nullable=False)
    # Optional structured diff payload
    payload: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    task: Mapped["Task"] = relationship(back_populates="activity")
