import axios from 'axios';

const TEAMS_BASE_URL = 'http://localhost:8000/api/teams';

export const teamsApi = axios.create({
  baseURL: TEAMS_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

teamsApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

teamsApi.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const projectManagerService = {
  getSummary: () => teamsApi.get('/summary'),
  getExecutiveSummary: () => teamsApi.get('/summary'),
  getTasks: (params?: { project?: string; assignee?: string; status?: string }) => teamsApi.get('/tasks', { params }),
  getPendingTasks: () => teamsApi.get('/tasks/pending'),
  sendReminders: () => teamsApi.post('/send-reminders'),
  sendRemindersSync: () => teamsApi.post('/send-reminders/sync'),
  getUtilization: () => teamsApi.get('/reports/utilization/data'),
  getResourceUtilization: () => teamsApi.get('/reports/utilization/data'),
  getDeliveryRisks: () => teamsApi.get('/tasks/pending'),
  getMilestones: (project?: string) => teamsApi.get('/targets', { params: { project } }),
  createMilestone: (data: any) => teamsApi.post('/targets', data),
  getEmployees: () => teamsApi.get('/employees'),
  getSkills: (employeeName: string) => teamsApi.get(`/skills/${encodeURIComponent(employeeName)}`),
  generateSkills: (employeeName: string) => teamsApi.get(`/skills/generate/${encodeURIComponent(employeeName)}`),
  updateSkills: (data: { employee_name: string; strengths?: string; weaknesses?: string }) => teamsApi.post('/skills', data),
  getTeamsReplies: (limit = 100) => teamsApi.get('/replied-history', { params: { limit } }),
  getPendingReplies: () => teamsApi.get('/pending-replies'),
  pollReplies: () => teamsApi.post('/teams/poll-replies/background'),
  getReminderHistory: (limit = 100) => teamsApi.get('/reminder-history', { params: { limit } }),
  getLogs: (limit = 100) => teamsApi.get('/logs', { params: { limit } }),
  getActivityLog: (limit = 100) => teamsApi.get('/logs', { params: { limit } }),
  getExcelSheets: () => teamsApi.get('/excel/sheets'),
  getExcelData: (sheet?: string) => teamsApi.get('/excel/data', { params: { sheet } }),
  getConfig: () => teamsApi.get('/config'),
  updateConfig: (data: any) => teamsApi.post('/config', data),
  getSchedulerStatus: () => teamsApi.get('/scheduler/status'),
};

