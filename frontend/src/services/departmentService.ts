import { api } from './api';

export const departmentService = {
  getDepartments: () => api.get('/departments'),
  getDepartment: (id: string) => api.get(`/departments/${id}`),
  createDepartment: (data: any) => api.post('/departments', data),
  updateDepartment: (id: string, data: any) => api.put(`/departments/${id}`, data),
  getDepartmentEmployees: (id: string) => api.get(`/departments/${id}/employees`),
  getDepartmentProjects: (id: string) => api.get(`/departments/${id}/projects`),
};
