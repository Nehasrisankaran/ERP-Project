from typing import List, Optional, Any
from pydantic import BaseModel

class DashboardKPI(BaseModel):
    id: str
    label: str
    value: Any
    trend: Optional[str] = None

class DashboardAttentionItem(BaseModel):
    id: str
    title: str
    type: str
    severity: str
    due_date: Optional[str] = None

class DashboardTaskItem(BaseModel):
    id: int
    title: str
    status: str
    priority: str
    due_date: Optional[str] = None

class DashboardResponse(BaseModel):
    role: str
    summary_kpis: List[DashboardKPI] = []
    attention_items: List[DashboardAttentionItem] = []
    recent_tasks: List[DashboardTaskItem] = []
    visualizations: List[dict] = []
