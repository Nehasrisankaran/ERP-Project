from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.db.session import get_db
from app.models.models import Department, User, Employee, EmploymentStatus, DepartmentStatus
from app.schemas.schemas import DepartmentCreate, DepartmentRead, DepartmentUpdate
from app.core.deps import get_current_active_user as get_current_user

router = APIRouter()

@router.get("", response_model=List[dict])
def get_departments(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    departments = db.query(Department).filter(Department.organization_id == current_user.organization_id).all()
    
    result = []
    for dept in departments:
        head_name = dept.head_employee.user.full_name if dept.head_employee and dept.head_employee.user else None
        
        # Calculate utilization and active projects loosely or keep it simple
        emp_ids = [e.id for e in dept.employees if e.status == EmploymentStatus.active]
        active_projects_count = 0
        if emp_ids:
            active_projects = set()
            for e in dept.employees:
                if e.status == EmploymentStatus.active:
                    for p in e.projects:
                        if p.status == "active":
                            active_projects.add(p.id)
            active_projects_count = len(active_projects)
            
        result.append({
            "id": dept.id,
            "name": dept.name,
            "code": dept.code,
            "description": dept.description,
            "status": dept.status.value if isinstance(dept.status, DepartmentStatus) else dept.status,
            "head": {
                "id": dept.head_employee_id,
                "name": head_name
            } if head_name else None,
            "employee_count": len(emp_ids),
            "active_project_count": active_projects_count,
            "utilization": 85 # Mocked loosely for now, real calculation would require more complex queries
        })
    return result

@router.post("", response_model=DepartmentRead)
def create_department(dept_in: DepartmentCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    new_dept = Department(
        name=dept_in.name,
        code=dept_in.code,
        description=dept_in.description,
        organization_id=dept_in.organization_id or current_user.organization_id,
        head_employee_id=dept_in.head_employee_id,
        status=dept_in.status or "active"
    )
    db.add(new_dept)
    db.commit()
    db.refresh(new_dept)
    return new_dept

@router.get("/{department_id}")
def get_department(department_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    dept = db.query(Department).filter(Department.id == department_id, Department.organization_id == current_user.organization_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
        
    head_name = dept.head_employee.user.full_name if dept.head_employee and dept.head_employee.user else None
    
    emp_ids = [e.id for e in dept.employees if e.status == EmploymentStatus.active]
    
    active_projects = set()
    completed_projects = set()
    for e in dept.employees:
        if e.status == EmploymentStatus.active:
            for p in e.projects:
                if p.status == "active":
                    active_projects.add(p.id)
                elif p.status == "completed":
                    completed_projects.add(p.id)
    
    return {
        "id": dept.id,
        "name": dept.name,
        "code": dept.code,
        "description": dept.description,
        "status": dept.status.value if isinstance(dept.status, DepartmentStatus) else dept.status,
        "head": {
            "id": dept.head_employee_id,
            "name": head_name
        } if head_name else None,
        "employee_count": len(emp_ids),
        "active_project_count": len(active_projects),
        "completed_project_count": len(completed_projects),
        "utilization": 87,
        "pending_tasks": 24, # placeholder, requires task aggregation
        "overdue_tasks": 3 # placeholder
    }

@router.put("/{department_id}", response_model=DepartmentRead)
def update_department(department_id: int, dept_in: DepartmentUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    dept = db.query(Department).filter(Department.id == department_id, Department.organization_id == current_user.organization_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
        
    update_data = dept_in.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(dept, key, value)
        
    db.commit()
    db.refresh(dept)
    return dept

@router.get("/{department_id}/employees")
def get_department_employees(department_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    dept = db.query(Department).filter(Department.id == department_id, Department.organization_id == current_user.organization_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
        
    result = []
    for emp in dept.employees:
        if emp.status != EmploymentStatus.active:
            continue
        manager = db.query(Employee).filter(Employee.id == emp.reporting_manager_id).first() if emp.reporting_manager_id else None
        manager_name = manager.user.full_name if manager and manager.user else None
        
        result.append({
            "id": emp.id,
            "user_id": emp.user.id,
            "name": emp.user.full_name,
            "email": emp.user.email,
            "designation": emp.designation,
            "status": emp.status.value if hasattr(emp.status, 'value') else emp.status,
            "projects_count": len([p for p in emp.projects if p.status == 'active']),
            "manager": manager_name,
            "avatar_url": emp.avatar_url
        })
    return result

@router.get("/{department_id}/projects")
def get_department_projects(department_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    dept = db.query(Department).filter(Department.id == department_id, Department.organization_id == current_user.organization_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
        
    projects = set()
    for emp in dept.employees:
        if emp.status == EmploymentStatus.active:
            for p in emp.projects:
                projects.add(p)
                
    result = []
    for p in projects:
        manager_name = p.manager.user.full_name if p.manager and p.manager.user else None
        
        # Calculate progress
        total_tasks = len(p.tasks)
        completed_tasks = sum(1 for t in p.tasks if t.status.value == 'completed') if total_tasks > 0 else 0
        progress = int((completed_tasks / total_tasks) * 100) if total_tasks > 0 else 0
        
        # Department involvement
        dept_members = sum(1 for m in p.members if m.department_id == department_id)
        
        result.append({
            "id": p.id,
            "name": p.name,
            "status": p.status.value if hasattr(p.status, 'value') else p.status,
            "manager": manager_name,
            "progress": progress,
            "deadline": p.target_date,
            "task_count": total_tasks,
            "department_involvement": dept_members
        })
    return result
