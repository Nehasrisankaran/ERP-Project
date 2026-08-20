export interface DashboardKPI {
  id: string;
  label: string;
  value: any;
  trend?: string;
}

export interface DashboardAttentionItem {
  id: string;
  title: string;
  type: string;
  severity: string;
  due_date?: string;
}

export interface DashboardTaskItem {
  id: number;
  title: string;
  status: string;
  priority: string;
  due_date?: string;
}

export interface DashboardVisualization {
  id: string;
  type: string;
  title: string;
  data: any;
}

export interface DashboardResponse {
  role: string;
  summary_kpis: DashboardKPI[];
  attention_items: DashboardAttentionItem[];
  recent_tasks: DashboardTaskItem[];
  visualizations: DashboardVisualization[];
}
