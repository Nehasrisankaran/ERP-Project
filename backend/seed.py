import httpx

BASE = "http://localhost:8000/api/v1"

# Get org id — org was already created (slug: acme-corp)
# We need to register the user and seed projects fresh

# Register user (org_id = 1 since it was created first)
reg = httpx.post(f"{BASE}/auth/register", json={
    "email": "admin@acme.com",
    "password": "admin123",
    "full_name": "Ravindhar Admin",
    "role": "admin",
    "organization_id": 1,
})
print("Register:", reg.status_code, reg.text[:200])

# Login
tok = httpx.post(f"{BASE}/auth/login", json={"email": "admin@acme.com", "password": "admin123"})
print("Login:", tok.status_code)
if tok.status_code != 200:
    print(tok.text)
    exit(1)

access = tok.json()["access_token"]
headers = {"Authorization": f"Bearer {access}"}

# Check me
me = httpx.get(f"{BASE}/auth/me", headers=headers)
org_id = me.json()["organization_id"]
print(f"Logged in as: {me.json()['full_name']}, org_id={org_id}")

# Create departments
for name in ["Engineering", "Product", "Design", "HR"]:
    r = httpx.post(f"{BASE}/departments", json={"name": name, "organization_id": org_id}, headers=headers)
    print(f"  Dept '{name}':", r.status_code)

# Create teams
for name, desc in [("Frontend", "React engineers"), ("Backend", "Python engineers"), ("Design", "UI/UX team")]:
    r = httpx.post(f"{BASE}/teams", json={"name": name, "description": desc, "organization_id": org_id}, headers=headers)
    print(f"  Team '{name}':", r.status_code)

# Create projects with tasks
projects = [
    {
        "proj": {"name": "WorkMate Platform v1", "description": "Building the company OS.", "organization_id": org_id, "priority": "critical", "work_mode": "sprint", "target_date": "2026-12-31", "start_date": "2026-08-01"},
        "tasks": [
            ("Set up monorepo structure", "completed", "high"),
            ("Design database schema", "completed", "critical"),
            ("Implement JWT authentication", "completed", "critical"),
            ("Build Kanban board UI", "in_progress", "high"),
            ("Build project list page", "in_progress", "high"),
            ("Employee management module", "in_progress", "medium"),
            ("Write API documentation", "not_started", "medium"),
            ("Set up CI/CD pipeline", "blocked", "high"),
            ("Deploy to production", "not_started", "high"),
        ]
    },
    {
        "proj": {"name": "Mobile App Redesign", "description": "Modernise the Flutter app.", "organization_id": org_id, "priority": "high", "work_mode": "milestone", "target_date": "2026-10-15", "start_date": "2026-08-16"},
        "tasks": [
            ("Audit existing UI components", "completed", "medium"),
            ("Create new design tokens", "in_progress", "high"),
            ("Redesign dashboard screen", "in_progress", "high"),
            ("Redesign task detail screen", "not_started", "medium"),
            ("User testing session", "not_started", "high"),
        ]
    },
    {
        "proj": {"name": "Internal Knowledge Base", "description": "Searchable internal wiki.", "organization_id": org_id, "priority": "medium", "work_mode": "standard", "target_date": "2026-09-30", "start_date": "2026-08-10"},
        "tasks": [
            ("Define content structure", "completed", "medium"),
            ("Set up wiki platform", "in_progress", "high"),
            ("Migrate existing docs", "not_started", "medium"),
            ("Write onboarding guide", "not_started", "low"),
        ]
    },
]

for item in projects:
    p = httpx.post(f"{BASE}/projects", json=item["proj"], headers=headers)
    print(f"\nProject '{item['proj']['name']}':", p.status_code)
    if p.status_code not in (200, 201):
        print("  Error:", p.text[:200])
        continue
    pid = p.json()["id"]
    for title, status, priority in item["tasks"]:
        t = httpx.post(f"{BASE}/projects/{pid}/tasks",
                       json={"title": title, "status": status, "priority": priority},
                       headers=headers)
        print(f"  Task '{title[:35]}':", t.status_code)

print("\n=== SEED DONE ===")
print("Login at http://localhost:5173")
print("Email   : admin@acme.com")
print("Password: admin123")
