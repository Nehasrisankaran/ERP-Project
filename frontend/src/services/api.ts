import axios from 'axios';

const BASE_URL = 'http://localhost:8000/api/v1';

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach token on each request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Refresh token on 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refresh = localStorage.getItem('refresh_token');
      if (refresh) {
        try {
          const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refresh_token: refresh });
          localStorage.setItem('access_token', data.access_token);
          localStorage.setItem('refresh_token', data.refresh_token);
          original.headers.Authorization = `Bearer ${data.access_token}`;
          return api(original);
        } catch {
          localStorage.clear();
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

// ── Auth ─────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  register: (data: { email: string; password: string; full_name: string; organization_id?: number }) =>
    api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
  updateMe: (data: any) => api.patch('/auth/me', data),
};

// ── Organization ─────────────────────────────────────────
export const orgApi = {
  create: (data: any) => api.post('/organizations', data),
  get: (id: number) => api.get(`/organizations/${id}`),
  update: (id: number, data: any) => api.patch(`/organizations/${id}`, data),
  departments: (orgId: number) => api.get(`/organizations/${orgId}/departments`),
  createDepartment: (data: any) => api.post('/departments', data),
  employees: (orgId: number) => api.get(`/organizations/${orgId}/employees`),
  createEmployee: (data: any) => api.post('/employees', data),
  teams: (orgId: number) => api.get(`/organizations/${orgId}/teams`),
  createTeam: (data: any) => api.post('/teams', data),
  deleteTeam: (teamId: number) => api.delete(`/teams/${teamId}`),
  addTeamMember: (teamId: number, employeeId: number) => api.post(`/teams/${teamId}/members`, { employee_id: employeeId }),
  removeTeamMember: (teamId: number, employeeId: number) => api.delete(`/teams/${teamId}/members/${employeeId}`),
  dashboard: (orgId: number) => api.get(`/organizations/${orgId}/dashboard`),
};

// ── Projects ─────────────────────────────────────────────
export const projectApi = {
  list: (orgId: number) => api.get(`/organizations/${orgId}/projects`),
  create: (data: any) => api.post('/projects', data),
  get: (id: number) => api.get(`/projects/${id}`),
  update: (id: number, data: any) => api.patch(`/projects/${id}`, data),
  delete: (id: number) => api.delete(`/projects/${id}`),
  // Scheduling & Projections
  getScheduleHealth: (projectId: number) => api.get(`/projects/${projectId}/schedule-health`),
  getCalendar: (projectId: number, params?: Record<string, any>) => api.get(`/projects/${projectId}/calendar`, { params }),
  getTimeline: (projectId: number) => api.get(`/projects/${projectId}/timeline`),
  getGantt: (projectId: number) => api.get(`/projects/${projectId}/gantt`),
  // Milestones
  getMilestones: (projectId: number) => api.get(`/projects/${projectId}/milestones`),
  createMilestone: (projectId: number, data: any) => api.post(`/projects/${projectId}/milestones`, data),
  updateMilestone: (milestoneId: number, data: any) => api.patch(`/milestones/${milestoneId}`, data),
  deleteMilestone: (milestoneId: number) => api.delete(`/milestones/${milestoneId}`),
};

// ── People ────────────────────────────────────────────────
export const peopleApi = {
  get: (empId: number) => api.get(`/employees/${empId}`),
  update: (empId: number, data: any) => api.patch(`/employees/${empId}`, data),
  tasks: (empId: number, params?: Record<string, any>) =>
    api.get(`/employees/${empId}/tasks`, { params }),
  projects: (empId: number) => api.get(`/employees/${empId}/projects`),
  teams: (empId: number) => api.get(`/employees/${empId}/teams`),
  directReports: (empId: number) => api.get(`/employees/${empId}/direct-reports`),
  activity: (empId: number, limit = 30) =>
    api.get(`/employees/${empId}/activity`, { params: { limit } }),
  suspend: (empId: number) => api.post(`/employees/${empId}/suspend`, {}),
  activate: (empId: number) => api.post(`/employees/${empId}/activate`, {}),
  deactivate: (empId: number) => api.post(`/employees/${empId}/deactivate`, {}),
  transferWork: (empId: number, toEmployeeId: number) =>
    api.post(`/employees/${empId}/transfer-work`, { to_employee_id: toEmployeeId }),
};

// ── Tasks ─────────────────────────────────────────────────
export const taskApi = {
  myTasks: (orgId: number) => api.get(`/organizations/${orgId}/my-tasks`),
  list: (projectId: number, params?: { status?: string; assignee_id?: number }) =>
    api.get(`/projects/${projectId}/tasks`, { params }),
  create: (projectId: number, data: any) => api.post(`/projects/${projectId}/tasks`, data),
  get: (id: number) => api.get(`/tasks/${id}`),
  update: (id: number, data: any) => api.patch(`/tasks/${id}`, data),
  delete: (id: number) => api.delete(`/tasks/${id}`),
  // Schedule quick update
  updateSchedule: (taskId: number, data: { start_date?: string; due_date?: string; estimated_hours?: number }) =>
    api.patch(`/tasks/${taskId}/schedule`, data),
  // Dependencies
  dependencies: (taskId: number) => api.get(`/tasks/${taskId}/dependencies`),
  addDependency: (taskId: number, data: { source_task_id: number; target_task_id: number; dependency_type?: string }) =>
    api.post(`/tasks/${taskId}/dependencies`, data),
  deleteDependency: (dependencyId: number) => api.delete(`/dependencies/${dependencyId}`),
  // Comments
  comments: (taskId: number) => api.get(`/tasks/${taskId}/comments`),
  addComment: (taskId: number, content: string) =>
    api.post(`/tasks/${taskId}/comments`, { content }),
  // Subtasks
  subtasks: (taskId: number) => api.get(`/tasks/${taskId}/subtasks`),
  createSubtask: (taskId: number, data: any) => api.post(`/tasks/${taskId}/subtasks`, data),
  // Activity
  activity: (taskId: number) => api.get(`/tasks/${taskId}/activity`),
};

