import pandas as pd
from sqlalchemy.orm import Session
from datetime import datetime
import json
import math

from app.db.session import SessionLocal
from app.models.models import Organization, Department, User, Employee, UserRole, EmploymentStatus
from app.core.security import get_password_hash

def get_role_from_designation(designation):
    designation = str(designation).lower()
    if 'head' in designation or 'director' in designation:
        return UserRole.admin
    elif 'manager' in designation or 'lead' in designation:
        return UserRole.manager
    elif 'analyst' in designation:
        return UserRole.team_lead
    return UserRole.employee

def import_employees():
    file_path = r"e:\Projects\WorkMate\workmate\backend\teams_reminder\Employee Master Sheet .xlsx"
    df = pd.read_excel(file_path)
    
    db = SessionLocal()
    
    try:
        # Ensure default organization exists
        org = db.query(Organization).first()
        if not org:
            org = Organization(name="Default Org", slug="default-org")
            db.add(org)
            db.commit()
            db.refresh(org)
            
        for _, row in df.iterrows():
            email = str(row.get('Official Email', '')).strip()
            if not email or email == 'nan':
                continue
                
            name = str(row.get('Employee Name', '')).strip()
            department_name = str(row.get('Department', '')).strip()
            designation = str(row.get('Current Designation', '')).strip()
            employee_code = str(row.get('Employee ID', '')).strip()
            phone = str(row.get('Contact Number', '')).strip()
            if phone.endswith('.0'): phone = phone[:-2]
            
            # Department
            dept = None
            if department_name and department_name != 'nan':
                dept = db.query(Department).filter_by(name=department_name).first()
                if not dept:
                    dept = Department(name=department_name, organization_id=org.id)
                    db.add(dept)
                    db.commit()
                    db.refresh(dept)
            
            # User
            user = db.query(User).filter_by(email=email).first()
            role = get_role_from_designation(designation)
            if not user:
                hashed_password = get_password_hash("password123")
                user = User(
                    email=email,
                    full_name=name,
                    hashed_password=hashed_password,
                    role=role,
                    organization_id=org.id
                )
                db.add(user)
                db.commit()
                db.refresh(user)
                
            # Employee
            employee = db.query(Employee).filter_by(user_id=user.id).first()
            
            # Handle Dates and NaNs
            def clean_str(val):
                if pd.isna(val): return None
                return str(val)
                
            personal_email = clean_str(row.get('Personal Email ID'))
            emergency_contact = clean_str(row.get('Emergency Contact Number'))
            if emergency_contact and emergency_contact.endswith('.0'): 
                emergency_contact = emergency_contact[:-2]
            permanent_address = clean_str(row.get('Permanent Address'))
            blood_group = clean_str(row.get('Blood Group'))
            employee_type = clean_str(row.get('Employee Type'))
            if employee_type: employee_type = employee_type.strip()
            
            dob_val = row.get('DOB')
            dob_str = None
            if not pd.isna(dob_val) and isinstance(dob_val, datetime):
                dob_str = dob_val.strftime('%Y-%m-%d')
            elif clean_str(dob_val):
                dob_str = clean_str(dob_val)
                
            doj_val = row.get('Date of Joining')
            doj_str = None
            if not pd.isna(doj_val) and isinstance(doj_val, datetime):
                doj_str = doj_val.strftime('%Y-%m-%d')
            elif clean_str(doj_val):
                doj_str = clean_str(doj_val)
                
            platform_role_mapping = {
                "designation": designation,
                "assigned_role": role.value,
                "access_level": "full" if role in [UserRole.admin, UserRole.super_admin] else "restricted"
            }
                
            if not employee:
                employee = Employee(
                    user_id=user.id,
                    organization_id=org.id,
                    department_id=dept.id if dept else None,
                    employee_code=employee_code,
                    designation=designation,
                    phone=phone,
                    date_joined=doj_str,
                    employee_type=employee_type,
                    dob=dob_str,
                    blood_group=blood_group,
                    personal_email=personal_email,
                    emergency_contact=emergency_contact,
                    permanent_address=permanent_address,
                    platform_role_mapping=platform_role_mapping
                )
                db.add(employee)
            else:
                employee.department_id = dept.id if dept else None
                employee.employee_code = employee_code
                employee.designation = designation
                employee.phone = phone
                employee.date_joined = doj_str
                employee.employee_type = employee_type
                employee.dob = dob_str
                employee.blood_group = blood_group
                employee.personal_email = personal_email
                employee.emergency_contact = emergency_contact
                employee.permanent_address = permanent_address
                employee.platform_role_mapping = platform_role_mapping
                
            db.commit()
            print(f"Imported/Updated {name} ({email})")
            
    except Exception as e:
        print("Error:", e)
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    import_employees()
