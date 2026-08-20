export type DashboardRole = 'employee' | 'manager' | 'department_head' | 'hr' | 'project_manager' | 'admin' | 'ceo';

export interface DashboardWidgetConfig {
  id: string;
  type: 'metrics' | 'tasks' | 'insights' | 'trend' | 'projects' | 'workload' | 'system_health';
  priority: 'P0' | 'P1' | 'P2';
  title?: string;
  gridSpan?: 'full' | 'half' | 'third';
}

export interface DashboardRoleConfig {
  role: DashboardRole;
  allowedWidgets: DashboardWidgetConfig[];
}

export const employeeDashboardConfig: DashboardRoleConfig = {
  role: 'employee',
  allowedWidgets: [
    { id: 'today_tasks', type: 'tasks', priority: 'P0', title: 'My Work Today', gridSpan: 'full' },
    { id: 'progress_metric', type: 'metrics', priority: 'P1', gridSpan: 'third' },
    { id: 'urgent_insights', type: 'insights', priority: 'P0', gridSpan: 'full' }
  ]
};

export const managerDashboardConfig: DashboardRoleConfig = {
  role: 'manager',
  allowedWidgets: [
    { id: 'team_health_metrics', type: 'metrics', priority: 'P0', gridSpan: 'full' },
    { id: 'team_workload', type: 'workload', priority: 'P0', gridSpan: 'full' },
    { id: 'urgent_insights', type: 'insights', priority: 'P0', gridSpan: 'full' },
    { id: 'team_projects', type: 'projects', priority: 'P1', gridSpan: 'full' }
  ]
};

export const hrDashboardConfig: DashboardRoleConfig = {
  role: 'hr',
  allowedWidgets: [
    { id: 'workforce_health_metrics', type: 'metrics', priority: 'P0', gridSpan: 'full' },
    { id: 'employee_distribution', type: 'workload', priority: 'P1', gridSpan: 'half' },
    { id: 'urgent_insights', type: 'insights', priority: 'P0', gridSpan: 'full' }
  ]
};

export const projectManagerDashboardConfig: DashboardRoleConfig = {
  role: 'project_manager',
  allowedWidgets: [
    { id: 'delivery_health_metrics', type: 'metrics', priority: 'P0', gridSpan: 'full' },
    { id: 'delivery_risks', type: 'projects', priority: 'P0', gridSpan: 'full' },
    { id: 'milestone_timeline', type: 'trend', priority: 'P1', gridSpan: 'half' },
    { id: 'urgent_insights', type: 'insights', priority: 'P0', gridSpan: 'full' }
  ]
};

export const adminDashboardConfig: DashboardRoleConfig = {
  role: 'admin',
  allowedWidgets: [
    { id: 'org_health_metrics', type: 'metrics', priority: 'P0', gridSpan: 'full' },
    { id: 'system_health', type: 'system_health', priority: 'P0', gridSpan: 'half' },
    { id: 'urgent_insights', type: 'insights', priority: 'P0', gridSpan: 'half' }
  ]
};

// Map backend role to dashboard role mapping
export function resolveDashboardRole(userRole?: string): DashboardRole {
  switch(userRole) {
    case 'super_admin':
    case 'admin': return 'admin'; // Can extend to ceo/hr based on more specific roles later
    case 'manager':
    case 'team_lead': return 'manager';
    case 'pm': return 'project_manager';
    // If there is an hr role in backend eventually, map it here
    case 'hr': return 'hr';
    default: return 'employee';
  }
}

export function getDashboardConfig(role: DashboardRole): DashboardRoleConfig {
  switch(role) {
    case 'admin': return adminDashboardConfig;
    case 'ceo': return adminDashboardConfig; // temporary fallback
    case 'hr': return hrDashboardConfig;
    case 'project_manager': return projectManagerDashboardConfig;
    case 'manager': return managerDashboardConfig;
    case 'department_head': return managerDashboardConfig; // temporary fallback
    case 'employee':
    default: return employeeDashboardConfig;
  }
}
