export type UserRole = 'super_admin' | 'admin' | 'manager' | 'team_lead' | 'employee' | 'hr' | 'intern';

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  organization_id: number | null;
  created_at: string;
}

export interface Organization {
  id: number;
  name: string;
  slug: string;
  industry: string | null;
  website: string | null;
  created_at: string;
}

export interface Department {
  id: number;
  name: string;
  description: string | null;
  organization_id: number;
  created_at: string;
}

export interface Employee {
  id: number;
  user_id: number;
  organization_id: number;
  department_id: number | null;
  employee_code: string | null;
  designation: string | null;
  phone: string | null;
  location: string | null;
  avatar_url: string | null;
  status: 'active' | 'on_leave' | 'terminated' | 'invited' | 'suspended';
  date_joined: string | null;
  created_at: string;
  full_name: string | null;
  email: string | null;
  role?: string | null;
  department_name: string | null;
  manager_id?: number | null;
  manager_name?: string | null;
  teams?: { id: number; name: string }[];
  active_tasks_count?: number;
  completed_tasks_count?: number;
  overdue_tasks_count?: number;
  active_projects_count?: number;
  estimated_hours?: number;
  workload_percentage?: number;
  workload_status?: string;
}

export interface TeamMember {
  id: number;
  full_name: string | null;
  email: string | null;
  designation: string | null;
  avatar_url: string | null;
  status: string | null;
}

export interface Team {
  id: number;
  name: string;
  description: string | null;
  organization_id: number;
  department_id: number | null;
  created_at: string;
  member_count?: number;
  members?: TeamMember[];
}

export type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';
export type ProjectWorkMode = 'standard' | 'milestone' | 'sprint' | 'milestone_sprint';
export type Priority = 'low' | 'medium' | 'high' | 'critical';
export type TaskStatus = 'not_started' | 'in_progress' | 'in_review' | 'blocked' | 'completed' | 'cancelled';

export interface Project {
  id: number;
  name: string;
  description: string | null;
  organization_id: number;
  status: ProjectStatus;
  priority: Priority;
  work_mode: ProjectWorkMode;
  start_date: string | null;
  target_date: string | null;
  manager_id: number | null;
  created_at: string;
  updated_at: string;
  task_count: number;
  completed_task_count: number;
}

export type ETAStatus = 'on_track' | 'at_risk' | 'delayed' | 'completed' | 'blocked';
export type MilestoneStatus = 'upcoming' | 'in_progress' | 'completed' | 'delayed';

export interface Milestone {
  id: number;
  project_id: number;
  name: string;
  description: string | null;
  target_date: string;
  status: MilestoneStatus;
  owner_id: number | null;
  owner_name: string | null;
  created_at: string;
  updated_at: string;
  total_tasks_count: number;
  completed_tasks_count: number;
  progress_percentage: number;
}

export interface TaskDependency {
  id: number;
  project_id: number;
  source_task_id: number;
  target_task_id: number;
  dependency_type: 'blocks' | 'blocked_by' | 'relates_to';
  source_task_title?: string;
  target_task_title?: string;
  created_at: string;
}

export interface ProjectScheduleHealth {
  health_status: 'On Track' | 'At Risk' | 'Delayed';
  total_tasks: number;
  completed_tasks: number;
  overall_progress: number;
  overdue_count: number;
  delayed_count: number;
  at_risk_count: number;
  blocked_count: number;
  next_milestone?: Milestone | null;
  milestones_count: number;
}

export interface Task {
  id: number;
  title: string;
  description: string | null;
  project_id: number;
  project_task_number?: number | null;
  status: TaskStatus;
  priority: Priority;
  assignee_id: number | null;
  parent_task_id: number | null;
  milestone_id?: number | null;
  milestone_name?: string | null;
  start_date: string | null;
  due_date: string | null;
  estimated_hours: number | null;
  position: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  comment_count: number;
  subtask_count: number;
  completed_subtask_count: number;
  assignee_name: string | null;
  assignee_avatar: string | null;
  project_name?: string | null;
  project_manager_user_id?: number | null;
  eta_status?: ETAStatus;
  eta_date?: string | null;
  is_overdue?: boolean;
  blocked_by_task_ids?: number[];
  blocking_task_ids?: number[];
  rework_count?: number;
  is_reopened?: boolean;
  reopened_at?: string | null;
  reopened_by?: number | null;
  reopen_reason?: string | null;
}


export interface TaskComment {
  id: number;
  task_id: number;
  author_id: number;
  content: string;
  created_at: string;
  author_name: string | null;
}

export interface TaskActivity {
  id: number;
  task_id: number;
  actor_id: number;
  actor_name: string | null;
  event_type: string;
  description: string;
  payload: Record<string, unknown> | null;
  created_at: string;
}

export interface DashboardStats {
  total_projects: number;
  active_projects: number;
  total_tasks: number;
  completed_tasks: number;
  in_progress_tasks: number;
  overdue_tasks: number;
  completion_rate: number;
}

export interface Token {
  access_token: string;
  refresh_token: string;
  token_type: string;
}
