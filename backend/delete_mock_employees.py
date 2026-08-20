from app.db.session import SessionLocal
from app.models.models import User, Employee
from sqlalchemy import text

def delete_mock_data():
    db = SessionLocal()
    
    mock_users = db.query(User).filter(
        (User.email.ilike("%@acme.com") | User.email.ilike("%@test.com")) & (User.id != 1)
    ).all()
    
    user_ids = [u.id for u in mock_users]
    if user_ids:
        user_ids_str = ','.join(map(str, user_ids))
        employees = db.query(Employee).filter(Employee.user_id.in_(user_ids)).all()
        emp_ids = [e.id for e in employees]
        if emp_ids:
            emp_ids_str = ','.join(map(str, emp_ids))
            db.execute(text(f"UPDATE employees SET reporting_manager_id = NULL WHERE user_id IN ({user_ids_str})"))
            db.execute(text(f"UPDATE milestones SET owner_id = NULL WHERE owner_id IN ({emp_ids_str})"))
            db.execute(text(f"UPDATE projects SET manager_id = NULL WHERE manager_id IN ({emp_ids_str})"))
            db.execute(text(f"UPDATE tasks SET assignee_id = NULL WHERE assignee_id IN ({emp_ids_str})"))
            db.execute(text(f"UPDATE departments SET head_employee_id = NULL WHERE head_employee_id IN ({emp_ids_str})"))
            db.execute(text(f"DELETE FROM team_members WHERE employee_id IN ({emp_ids_str})"))
            db.execute(text(f"DELETE FROM project_members WHERE employee_id IN ({emp_ids_str})"))
            db.execute(text(f"DELETE FROM task_collaborators WHERE employee_id IN ({emp_ids_str})"))
            db.execute(text(f"DELETE FROM task_watchers WHERE employee_id IN ({emp_ids_str})"))
        
        for u in mock_users:
            print(f"Deleting user {u.email}")
            emp = db.query(Employee).filter(Employee.user_id == u.id).first()
            if emp:
                db.delete(emp)
            db.delete(u)
        
    db.commit()
    print("Mock users deleted.")
    db.close()

if __name__ == "__main__":
    delete_mock_data()
