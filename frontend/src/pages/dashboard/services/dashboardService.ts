import { api } from '../../../services/api';
import type { DashboardResponse } from '../../../types/dashboard';
import { useQuery } from '@tanstack/react-query';

export const dashboardService = {
  getDashboard: async (): Promise<DashboardResponse> => {
    const { data } = await api.get('/dashboard');
    return data;
  }
};

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: dashboardService.getDashboard,
    staleTime: 0, // force refetch for now
    retry: 1
  });
}
