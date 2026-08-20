import httpx
import pytest

BASE = "http://localhost:8000/api/v1"

@pytest.fixture
def admin_client():
    tok = httpx.post(f"{BASE}/auth/login", json={"email": "admin@acme.com", "password": "admin123"})
    client = httpx.Client(base_url=BASE, headers={"Authorization": "Bearer " + tok.json()["access_token"]})
    yield client
    client.close()

@pytest.fixture
def emp_client():
    tok = httpx.post(f"{BASE}/auth/login", json={"email": "john.doe@acme.com", "password": "emp123"})
    client = httpx.Client(base_url=BASE, headers={"Authorization": "Bearer " + tok.json()["access_token"]})
    yield client
    client.close()

def setup_test_project(admin_client):
    me = admin_client.get("/auth/me").json()
    project = admin_client.post("/projects", json={
        "name": "Test Rework Project",
        "organization_id": me["organization_id"]
    }).json()
    return project

def create_test_task(admin_client, project_id):
    task = admin_client.post(f"/projects/{project_id}/tasks", json={
        "title": "Test Rework Task",
        "status": "not_started"
    }).json()
    return task

def test_normal_completion(admin_client):
    proj = setup_test_project(admin_client)
    task = create_test_task(admin_client, proj["id"])
    
    # TODO -> IN_PROGRESS -> DONE
    admin_client.patch(f"/tasks/{task['id']}", json={"status": "in_progress"})
    t = admin_client.patch(f"/tasks/{task['id']}", json={"status": "completed"}).json()
    
    assert t["rework_count"] == 0
    assert t["is_reopened"] == False

def test_tl_reopens_completed_task(admin_client):
    proj = setup_test_project(admin_client)
    task = create_test_task(admin_client, proj["id"])
    
    admin_client.patch(f"/tasks/{task['id']}", json={"status": "completed"})
    
    t = admin_client.patch(f"/tasks/{task['id']}", json={
        "status": "not_started",
        "reopen_reason": "Needs more testing"
    }).json()
    
    assert t["rework_count"] == 1
    assert t["is_reopened"] == True
    assert t["reopen_reason"] == "Needs more testing"
    assert t["reopened_by"] is not None
    
    activity = admin_client.get(f"/tasks/{task['id']}/activity").json()
    reopen_events = [a for a in activity if a["event_type"] == "TASK_REOPENED"]
    assert len(reopen_events) == 1
    assert reopen_events[0]["payload"]["comment"] == "Needs more testing"

def test_tl_attempts_reopen_without_comment(admin_client):
    proj = setup_test_project(admin_client)
    task = create_test_task(admin_client, proj["id"])
    
    admin_client.patch(f"/tasks/{task['id']}", json={"status": "completed"})
    
    r = admin_client.patch(f"/tasks/{task['id']}", json={
        "status": "not_started"
    })
    assert r.status_code == 400
    assert "A comment is required" in r.json()["detail"]

def test_emp_attempts_reopen(admin_client, emp_client):
    proj = setup_test_project(admin_client)
    task = create_test_task(admin_client, proj["id"])
    
    admin_client.patch(f"/tasks/{task['id']}", json={"status": "completed"})
    
    r = emp_client.patch(f"/tasks/{task['id']}", json={
        "status": "not_started",
        "reopen_reason": "I think it needs more work"
    })
    
    assert r.status_code == 403

def test_reworked_task_completed_again(admin_client):
    proj = setup_test_project(admin_client)
    task = create_test_task(admin_client, proj["id"])
    
    admin_client.patch(f"/tasks/{task['id']}", json={"status": "completed"})
    admin_client.patch(f"/tasks/{task['id']}", json={
        "status": "not_started",
        "reopen_reason": "Needs more testing"
    })
    admin_client.patch(f"/tasks/{task['id']}", json={"status": "in_progress"})
    t = admin_client.patch(f"/tasks/{task['id']}", json={"status": "completed"}).json()
    
    assert t["rework_count"] == 1
    assert t["is_reopened"] == False

def test_multiple_rework_cycles(admin_client):
    proj = setup_test_project(admin_client)
    task = create_test_task(admin_client, proj["id"])
    
    admin_client.patch(f"/tasks/{task['id']}", json={"status": "completed"})
    admin_client.patch(f"/tasks/{task['id']}", json={
        "status": "not_started",
        "reopen_reason": "Cycle 1"
    })
    admin_client.patch(f"/tasks/{task['id']}", json={"status": "completed"})
    t = admin_client.patch(f"/tasks/{task['id']}", json={
        "status": "not_started",
        "reopen_reason": "Cycle 2"
    }).json()
    
    assert t["rework_count"] == 2
    assert t["is_reopened"] == True
    
    admin_client.patch(f"/tasks/{task['id']}", json={"status": "completed"})
    
    t_final = admin_client.get(f"/tasks/{task['id']}").json()
    assert t_final["rework_count"] == 2
    assert t_final["is_reopened"] == False
    
    activity = admin_client.get(f"/tasks/{task['id']}/activity").json()
    reopen_events = [a for a in activity if a["event_type"] == "TASK_REOPENED"]
    assert len(reopen_events) == 2
