import httpx

BASE = "http://localhost:8000/api/v1"

tok = httpx.post(f"{BASE}/auth/login", json={"email": "admin@acme.com", "password": "admin123"})
headers = {"Authorization": "Bearer " + tok.json()["access_token"]}

me = httpx.get(f"{BASE}/auth/me", headers=headers).json()
org_id = me["organization_id"]
print(f"User: {me['full_name']} | org_id: {org_id}")

dash = httpx.get(f"{BASE}/organizations/{org_id}/dashboard", headers=headers).json()
print("Dashboard:", dash)

projs = httpx.get(f"{BASE}/organizations/{org_id}/projects", headers=headers).json()
print(f"Projects count: {len(projs)}")
for p in projs:
    print(f"  [{p['id']}] {p['name']} | {p['status']} | tasks={p['task_count']}")

if projs:
    tasks = httpx.get(f"{BASE}/projects/{projs[0]['id']}/tasks", headers=headers).json()
    print(f"Tasks in '{projs[0]['name']}': {len(tasks)}")
    for t in tasks:
        print(f"  [{t['status']}] {t['priority'].upper()} - {t['title']}")

depts = httpx.get(f"{BASE}/organizations/{org_id}/departments", headers=headers).json()
print(f"Departments: {[d['name'] for d in depts]}")

teams = httpx.get(f"{BASE}/organizations/{org_id}/teams", headers=headers).json()
print(f"Teams: {[t['name'] for t in teams]}")
