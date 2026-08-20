from typing import List
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, and_

from app.models.models import User, Employee, Task, Project, Department, Team, team_members
from app.schemas.dashboard import DashboardResponse, DashboardKPI, DashboardAttentionItem, DashboardTaskItem

def _get_date_strings():
    now = datetime.utcnow()
    today_str = now.strftime("%Y-%m-%d")
    next_week_str = (now + timedelta(days=7)).strftime("%Y-%m-%d")
    return today_str, next_week_str

def get_employee_dashboard(user: User, db: Session) -> DashboardResponse:
    if not user.employee:
        return DashboardResponse(role="employee")

    today_str, next_week_str = _get_date_strings()
    org_id = user.organization_id
    emp_id = user.employee.id

    # Base query for tasks assigned to the employee
    base_task_query = db.query(Task).join(Project).filter(
        Project.organization_id == org_id,
        Task.assignee_id == emp_id
    )

    # 1. Total assigned tasks (not cancelled)
    total_tasks = base_task_query.filter(Task.status != 'cancelled').count()
    
    # 2. Completed tasks
    completed_tasks = base_task_query.filter(Task.status == 'completed').count()
    
    # 3. Overdue Tasks
    overdue_query = base_task_query.filter(
        Task.status.notin_(['completed', 'cancelled']),
        Task.due_date < today_str
    )
    overdue_count = overdue_query.count()

    # 4. Today's Tasks (due today or in progress)
    today_count = base_task_query.filter(
        Task.status.notin_(['completed', 'cancelled']),
        or_(Task.due_date == today_str, Task.status == 'in_progress')
    ).count()

    # 5. Progress
    progress = 0
    if total_tasks > 0:
        progress = round((completed_tasks / total_tasks) * 100)

    # Attention Items (Overdue + High Priority)
    attention_tasks = overdue_query.order_by(Task.due_date.asc()).limit(5).all()
    attention_items = []
    for t in attention_tasks:
        attention_items.append(DashboardAttentionItem(
            id=str(t.id),
            title=t.title,
            type="task",
            severity="high" if t.priority in ['high', 'critical'] else "medium",
            due_date=t.due_date
        ))

    # Upcoming Tasks
    upcoming_tasks = base_task_query.filter(
        Task.status.notin_(['completed', 'cancelled']),
        Task.due_date >= today_str,
        Task.due_date <= next_week_str
    ).order_by(Task.due_date.asc()).limit(5).all()

    recent_items = [
        DashboardTaskItem(
            id=t.id, title=t.title, status=t.status, 
            priority=t.priority, due_date=t.due_date
        ) for t in upcoming_tasks
    ]

    return DashboardResponse(
        role="employee",
        summary_kpis=[
            DashboardKPI(id="today", label="Today's Tasks", value=today_count),
            DashboardKPI(id="overdue", label="Overdue", value=overdue_count),
            DashboardKPI(id="completed", label="Completed", value=completed_tasks),
            DashboardKPI(id="progress", label="Completion Progress", value=f"{progress}%")
        ],
        attention_items=attention_items,
        recent_tasks=recent_items,
        visualizations=[
            {
                "id": "task_status_dist",
                "title": "My Task Status Distribution",
                "type": "distribution",
                "data": [
                    {"label": "Completed", "value": completed_tasks},
                    {"label": "Overdue", "value": overdue_count},
                    {"label": "Pending", "value": total_tasks - completed_tasks - overdue_count}
                ]
            }
        ]
    )

def get_manager_dashboard(user: User, db: Session) -> DashboardResponse:
    if not user.employee:
        return DashboardResponse(role="manager")
        
    org_id = user.organization_id
    emp_id = user.employee.id
    today_str, _ = _get_date_strings()

    # Find team members
    team_members_query = db.query(Employee.id).filter(
        Employee.organization_id == org_id,
        Employee.reporting_manager_id == emp_id,
        Employee.status == 'active'
    )
    team_member_ids = [r[0] for r in team_members_query.all()]
    
    # Check if lead of any teams
    teams = db.query(Team).filter(Team.organization_id == org_id, Team.lead_id == emp_id).all()
    for t in teams:
        for m in t.members:
            if m.id not in team_member_ids and m.status == 'active':
                team_member_ids.append(m.id)

    team_size = len(team_member_ids)
    
    if not team_member_ids:
        return DashboardResponse(
            role="manager",
            summary_kpis=[DashboardKPI(id="team_size", label="Team Size", value=0)]
        )

    # Tasks for team
    base_task_query = db.query(Task).join(Project).filter(
        Project.organization_id == org_id,
        Task.assignee_id.in_(team_member_ids)
    )

    total_tasks = base_task_query.filter(Task.status != 'cancelled').count()
    completed_tasks = base_task_query.filter(Task.status == 'completed').count()
    in_progress_tasks = base_task_query.filter(Task.status == 'in_progress').count()
    
    overdue_query = base_task_query.filter(
        Task.status.notin_(['completed', 'cancelled']),
        Task.due_date < today_str
    )
    overdue_count = overdue_query.count()

    attention_tasks = overdue_query.order_by(Task.due_date.asc()).limit(5).all()
    attention_items = []
    for t in attention_tasks:
        attention_items.append(DashboardAttentionItem(
            id=str(t.id), title=t.title, type="task",
            severity="high", due_date=t.due_date
        ))

    return DashboardResponse(
        role="manager",
        summary_kpis=[
            DashboardKPI(id="team_size", label="Team Members", value=team_size),
            DashboardKPI(id="total_tasks", label="Team Tasks", value=total_tasks),
            DashboardKPI(id="in_progress", label="In Progress", value=in_progress_tasks),
            DashboardKPI(id="overdue", label="Overdue", value=overdue_count)
        ],
        attention_items=attention_items,
        visualizations=[
            {
                "id": "team_task_dist",
                "title": "Team Task Distribution",
                "type": "distribution",
                "data": [
                    {"label": "Completed", "value": completed_tasks},
                    {"label": "In Progress", "value": in_progress_tasks},
                    {"label": "Overdue", "value": overdue_count}
                ]
            }
        ]
    )

def get_hr_dashboard(user: User, db: Session) -> DashboardResponse:
    org_id = user.organization_id
    
    active_emps = db.query(Employee).filter(
        Employee.organization_id == org_id,
        Employee.status == 'active'
    ).count()
    
    total_depts = db.query(Department).filter(
        Department.organization_id == org_id,
        Department.status == 'active'
    ).count()
    
    return DashboardResponse(
        role="hr",
        summary_kpis=[
            DashboardKPI(id="active_employees", label="Active Employees", value=active_emps),
            DashboardKPI(id="departments", label="Departments", value=total_depts)
        ],
        visualizations=[
            {
                "id": "hr_overview",
                "title": "Workforce Trend Overview",
                "type": "distribution",
                "data": [
                    {"label": "Active Employees", "value": active_emps},
                    {"label": "Departments", "value": total_depts}
                ]
            }
        ]
    )

def get_admin_dashboard(user: User, db: Session) -> DashboardResponse:
    org_id = user.organization_id
    
    emps = db.query(Employee).filter(Employee.organization_id == org_id).count()
    projects = db.query(Project).filter(Project.organization_id == org_id).count()
    tasks = db.query(Task).join(Project).filter(Project.organization_id == org_id).count()
    
    return DashboardResponse(
        role="admin",
        summary_kpis=[
            DashboardKPI(id="total_employees", label="Total Employees", value=emps),
            DashboardKPI(id="total_projects", label="Total Projects", value=projects),
            DashboardKPI(id="total_tasks", label="Total Tasks", value=tasks)
        ],
        visualizations=[
            {
                "id": "org_breakdown",
                "title": "Platform Usage Breakdown",
                "type": "trend",
                "data": [
                    {"label": "Employees", "value": emps},
                    {"label": "Projects", "value": projects},
                    {"label": "Tasks", "value": tasks}
                ]
            }
        ]
    )

def get_pm_dashboard(user: User, db: Session) -> DashboardResponse:
    if not user.employee:
        return DashboardResponse(role="project_manager")
        
    org_id = user.organization_id
    emp_id = user.employee.id
    today_str, _ = _get_date_strings()
    
    managed_projects = db.query(Project).filter(
        Project.organization_id == org_id,
        Project.manager_id == emp_id
    ).all()
    
    project_ids = [p.id for p in managed_projects]
    
    if not project_ids:
        return DashboardResponse(
            role="project_manager",
            summary_kpis=[DashboardKPI(id="managed_projects", label="Managed Projects", value=0)]
        )
        
    active_projects = sum(1 for p in managed_projects if p.status == 'active')
    
    base_task_query = db.query(Task).filter(Task.project_id.in_(project_ids))
    overdue_count = base_task_query.filter(
        Task.status.notin_(['completed', 'cancelled']),
        Task.due_date < today_str
    ).count()
    
    # Let's just return basic counts
    return DashboardResponse(
        role="project_manager",
        summary_kpis=[
            DashboardKPI(id="managed_projects", label="Total Projects", value=len(project_ids)),
            DashboardKPI(id="active_projects", label="Active Projects", value=active_projects),
            DashboardKPI(id="overdue_tasks", label="Overdue Tasks", value=overdue_count)
        ],
        visualizations=[
            {
                "id": "project_health",
                "title": "Overall Project Health",
                "type": "trend",
                "data": [
                    {"label": "Total Projects", "value": len(project_ids)},
                    {"label": "Active Projects", "value": active_projects},
                    {"label": "Overdue Tasks", "value": overdue_count}
                ]
            }
        ]
    )

def get_dashboard(user: User, db: Session) -> DashboardResponse:
    # 1. Contextual overrides based on domain relationships
    if user.employee:
        emp_id = user.employee.id
        # Check if PM
        is_pm = db.query(Project).filter(
            Project.organization_id == user.organization_id, 
            Project.manager_id == emp_id
        ).first() is not None
        
        # Check if Department Head
        is_dept_head = db.query(Department).filter(
            Department.organization_id == user.organization_id,
            Department.head_employee_id == emp_id
        ).first() is not None
        
        if is_dept_head:
            # We can use manager dashboard for now as a structural fallback
            return get_manager_dashboard(user, db)
            
        if is_pm and user.role.value not in ['admin', 'super_admin', 'manager']:
            return get_pm_dashboard(user, db)

    # 2. Base role routing
    if user.role.value in ['super_admin', 'admin']:
        return get_admin_dashboard(user, db)
    elif user.role.value in ['hr']:
        return get_hr_dashboard(user, db)
    elif user.role.value in ['manager', 'team_lead']:
        return get_manager_dashboard(user, db)
    
    # Fallback to employee
    return get_employee_dashboard(user, db)
