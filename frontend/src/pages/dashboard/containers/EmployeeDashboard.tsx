import { DashboardShell, DashboardKPIGrid, DashboardAttentionList, DashboardTaskList, DashboardVisualization } from '../../../components/dashboard';
import type { DashboardRoleConfig } from '../config/dashboardConfig';
import { useAuthStore } from '../../../stores/authStore';
import type { DashboardResponse } from '../../../types/dashboard';

export function EmployeeDashboard({ data }: { config: DashboardRoleConfig, data?: DashboardResponse }) {
  const { user } = useAuthStore();
  const firstName = user?.full_name?.split(' ')[0] ?? 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <DashboardShell greeting={`${greeting}, ${firstName} 👋`} subtitle="Here's what needs your attention today.">
      <div className="space-y-6">
        <DashboardKPIGrid kpis={data?.summary_kpis || []} />
        <DashboardVisualization visualizations={data?.visualizations || []} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <DashboardTaskList tasks={data?.recent_tasks || []} title="My Work Today" />
          <DashboardAttentionList items={data?.attention_items || []} />
        </div>
      </div>
    </DashboardShell>
  );
}
