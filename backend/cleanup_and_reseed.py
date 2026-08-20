"""
cleanup_and_reseed.py
Removes duplicate/orphan employees & users so that
All Employees and Teams show the same consistent set of people.
Run with: venv\Scripts\python cleanup_and_reseed.py
"""
from app.db.session import SessionLocal
from app.models.models import (
    Employee, User, Team, Department, Organization, Project,
    team_members, project_members, UserRole, EmploymentStatus, Task,
    Milestone, MilestoneStatus, TaskDependency, DependencyType, Priority, TaskStatus
)
from app.core.security import get_password_hash
from sqlalchemy import text

def cleanup():
    db = SessionLocal()

    print("=== Cleaning up duplicates ===")

    # 1. Remove all dependencies, milestones, tasks, team memberships, projects
    db.query(TaskDependency).delete()
    db.query(Milestone).delete()
    db.query(Task).delete()
    db.execute(team_members.delete())
    db.execute(project_members.delete())
    db.query(Team).delete()
    db.query(Project).delete()
    db.query(Employee).delete()
    db.query(User).filter(User.email != "admin@acme.com").delete()
    db.query(Department).filter(Department.organization_id == 1).delete()
    db.commit()
    print("  Database cleaned.\n")


    # ── Re-seed ────────────────────────────────────────────
    print("=== Re-seeding ===")

    org = db.query(Organization).filter(Organization.id == 1).first()
    if not org:
        org = Organization(name="Fanam Digitals", slug="fanam-digitals", industry="Software & SaaS")

        db.add(org)
        db.flush()

    # Admin user
    admin_user = db.query(User).filter(User.email == "admin@acme.com").first()
    if not admin_user:
        admin_user = User(
            email="admin@acme.com",
            full_name="Ravindhar Admin",
            hashed_password=get_password_hash("admin123"),
            role=UserRole.admin,
            organization_id=org.id,
            is_active=True,
        )
        db.add(admin_user)
        db.flush()

    # Departments
    dept_eng  = Department(name="Engineering",         description="Software development & DevOps", organization_id=org.id)
    dept_prod = Department(name="Product & Design",    description="Product strategy, UI/UX, and research", organization_id=org.id)
    dept_hr   = Department(name="People Operations",   description="HR, talent, and culture", organization_id=org.id)
    dept_mkt  = Department(name="Growth & Marketing",  description="Marketing and growth engineering", organization_id=org.id)
    db.add_all([dept_eng, dept_prod, dept_hr, dept_mkt])
    db.flush()

    # Employee definitions — one single source of truth
    employees_data = [
        # (email, full_name, designation, department, code, location, role)
        ("admin@acme.com",           "Ravindhar Admin",   "CEO & Co-Founder",                   dept_prod, "EMP-001", "San Francisco, CA",  UserRole.admin),
        ("sarah.connor@acme.com",    "Sarah Connor",      "Lead Frontend Engineer",              dept_eng,  "EMP-002", "San Francisco, CA",  UserRole.employee),
        ("alex.chen@acme.com",       "Alex Chen",         "Senior React & TypeScript Developer", dept_eng,  "EMP-003", "Seattle, WA",        UserRole.employee),
        ("alice.johnson@acme.com",   "Alice Johnson",     "Frontend Engineer",                   dept_eng,  "EMP-004", "Austin, TX",         UserRole.employee),
        ("david.miller@acme.com",    "David Miller",      "Principal Backend Architect",         dept_eng,  "EMP-005", "New York, NY",       UserRole.employee),
        ("priya.sharma@acme.com",    "Priya Sharma",      "Python & FastAPI Specialist",         dept_eng,  "EMP-006", "Remote, India",      UserRole.employee),
        ("elena.rodriguez@acme.com", "Elena Rodriguez",   "Staff UI/UX Designer",               dept_prod, "EMP-007", "Los Angeles, CA",    UserRole.employee),
        ("bob.smith@acme.com",       "Bob Smith",         "Group Product Manager",               dept_prod, "EMP-008", "Chicago, IL",        UserRole.manager),
    ]

    emp_map = {}
    for email, full_name, designation, dept, code, loc, role in employees_data:
        usr = db.query(User).filter(User.email == email).first()
        if not usr:
            usr = User(
                email=email,
                full_name=full_name,
                hashed_password=get_password_hash("admin123"),
                role=role,
                organization_id=org.id,
                is_active=True,
            )
            db.add(usr)
            db.flush()
        else:
            usr.full_name = full_name
            usr.role = role
            usr.is_active = True

        emp = Employee(
            user_id=usr.id,
            organization_id=org.id,
            department_id=dept.id,
            employee_code=code,
            designation=designation,
            location=loc,
            status=EmploymentStatus.active,
            date_joined="2024-03-01",
        )
        db.add(emp)
        db.flush()
        emp_map[email] = emp
        print(f"  Created employee: {full_name} ({email})")

    db.flush()

    # Set reporting managers
    emp_map["sarah.connor@acme.com"].reporting_manager_id    = emp_map["admin@acme.com"].id
    emp_map["alex.chen@acme.com"].reporting_manager_id       = emp_map["sarah.connor@acme.com"].id
    emp_map["alice.johnson@acme.com"].reporting_manager_id   = emp_map["sarah.connor@acme.com"].id
    emp_map["david.miller@acme.com"].reporting_manager_id    = emp_map["admin@acme.com"].id
    emp_map["priya.sharma@acme.com"].reporting_manager_id    = emp_map["david.miller@acme.com"].id
    emp_map["elena.rodriguez@acme.com"].reporting_manager_id = emp_map["bob.smith@acme.com"].id
    emp_map["bob.smith@acme.com"].reporting_manager_id       = emp_map["admin@acme.com"].id
    db.flush()

    # Teams
    teams_def = [
        {
            "name": "Frontend Guild",
            "description": "Responsible for core web platform, UI component system, and modern user experience.",
            "dept": dept_eng,
            "lead": emp_map["sarah.connor@acme.com"],
            "members": ["sarah.connor@acme.com", "alex.chen@acme.com", "alice.johnson@acme.com"],
        },
        {
            "name": "Backend & Core Platform",
            "description": "Building microservices, database architecture, high-performance APIs, and security.",
            "dept": dept_eng,
            "lead": emp_map["david.miller@acme.com"],
            "members": ["david.miller@acme.com", "priya.sharma@acme.com", "admin@acme.com"],
        },
        {
            "name": "Product Experience (PX)",
            "description": "Cross-functional team leading design sprints, user research, and product features.",
            "dept": dept_prod,
            "lead": emp_map["elena.rodriguez@acme.com"],
            "members": ["elena.rodriguez@acme.com", "bob.smith@acme.com", "alex.chen@acme.com"],
        },
        {
            "name": "Growth & Performance",
            "description": "Focused on onboarding funnels, analytics, and performance tuning.",
            "dept": dept_mkt,
            "lead": emp_map["bob.smith@acme.com"],
            "members": ["bob.smith@acme.com", "alice.johnson@acme.com", "priya.sharma@acme.com"],
        },
        {
            "name": "People Operations",
            "description": "Company culture, employee onboarding, career ladders, and workspace health.",
            "dept": dept_hr,
            "lead": emp_map["admin@acme.com"],
            "members": ["admin@acme.com", "bob.smith@acme.com"],
        },
    ]

    for t_def in teams_def:
        team = Team(
            name=t_def["name"],
            description=t_def["description"],
            organization_id=org.id,
            department_id=t_def["dept"].id,
            lead_id=t_def["lead"].id,
        )
        members = [emp_map[e] for e in t_def["members"]]
        team.members.extend(members)
        db.add(team)
        print(f"  Created team: {t_def['name']} ({len(members)} members)")

    db.commit()

    # ── Seed Canonical Projects, Milestones, Tasks & Dependencies ────────
    print("\n=== Seeding Projects, Milestones, Tasks & Dependencies ===")
    proj1 = Project(
        name="Website Redesign",
        description="Comprehensive revamp of the core product marketing site and web app dashboard experience.",
        organization_id=org.id,
        status="active",
        priority=Priority.high,
        start_date="2026-08-10",
        target_date="2026-09-30",
        manager_id=emp_map["david.miller@acme.com"].id,
        created_by_id=admin_user.id
    )
    db.add(proj1)
    db.flush()

    # Milestones
    m1 = Milestone(project_id=proj1.id, name="Requirements & Design Complete", target_date="2026-08-18", status=MilestoneStatus.completed, owner_id=emp_map["elena.rodriguez@acme.com"].id)
    m2 = Milestone(project_id=proj1.id, name="Backend Architecture Complete", target_date="2026-08-27", status=MilestoneStatus.in_progress, owner_id=emp_map["david.miller@acme.com"].id)
    m3 = Milestone(project_id=proj1.id, name="Beta Release Launch", target_date="2026-09-15", status=MilestoneStatus.upcoming, owner_id=emp_map["alex.chen@acme.com"].id)
    db.add_all([m1, m2, m3])
    db.flush()

    # Scheduled Tasks
    t1 = Task(project_id=proj1.id, milestone_id=m1.id, title="UX Wireframes & Component Specs", description="Finalize design tokens and Figma wireframes", status=TaskStatus.completed, priority=Priority.high, start_date="2026-08-10", due_date="2026-08-17", assignee_id=emp_map["elena.rodriguez@acme.com"].id, position=1)
    t2 = Task(project_id=proj1.id, milestone_id=m2.id, title="API Development & Database Schema", description="Implement FastAPI routes and SQLite models", status=TaskStatus.in_progress, priority=Priority.critical, start_date="2026-08-17", due_date="2026-08-22", assignee_id=emp_map["david.miller@acme.com"].id, position=2)
    t3 = Task(project_id=proj1.id, milestone_id=m2.id, title="Authentication & Role Management", description="JWT login, refresh flow, role permissions", status=TaskStatus.in_progress, priority=Priority.high, start_date="2026-08-18", due_date="2026-08-23", assignee_id=emp_map["priya.sharma@acme.com"].id, position=3)
    t4 = Task(project_id=proj1.id, milestone_id=m3.id, title="Frontend UI Integration & State", description="Connect React UI tabs to FastAPI scheduling routes", status=TaskStatus.not_started, priority=Priority.high, start_date="2026-08-23", due_date="2026-08-30", assignee_id=emp_map["alex.chen@acme.com"].id, position=4)
    t5 = Task(project_id=proj1.id, milestone_id=m3.id, title="QA Testing & E2E Verification", description="Execute playbooks and browser testing", status=TaskStatus.not_started, priority=Priority.medium, start_date="2026-08-30", due_date="2026-09-05", assignee_id=emp_map["bob.smith@acme.com"].id, position=5)

    # Unscheduled Task
    t_unsched = Task(project_id=proj1.id, title="Performance Optimization & Cache Layer", description="Optimize query execution for large projects", status=TaskStatus.not_started, priority=Priority.low, assignee_id=emp_map["david.miller@acme.com"].id, position=6)

    db.add_all([t1, t2, t3, t4, t5, t_unsched])
    db.flush()

    # Dependencies: t2 (API Dev) blocks t4 (Frontend UI), t3 (Auth) blocks t4 (Frontend UI)
    d1 = TaskDependency(project_id=proj1.id, source_task_id=t2.id, target_task_id=t4.id, dependency_type=DependencyType.blocks, created_by_id=admin_user.id)
    d2 = TaskDependency(project_id=proj1.id, source_task_id=t3.id, target_task_id=t4.id, dependency_type=DependencyType.blocks, created_by_id=admin_user.id)
    d3 = TaskDependency(project_id=proj1.id, source_task_id=t4.id, target_task_id=t5.id, dependency_type=DependencyType.blocks, created_by_id=admin_user.id)
    db.add_all([d1, d2, d3])

    db.commit()
    print("  Created canonical project 'Website Redesign' with 3 milestones, 6 tasks, and 3 dependencies.")

    print("\n=== Done! ===")
    print(f"  {len(employees_data)} employees   |   {len(teams_def)} teams")
    print("\nLogin: admin@acme.com / admin123")

if __name__ == "__main__":
    cleanup()

