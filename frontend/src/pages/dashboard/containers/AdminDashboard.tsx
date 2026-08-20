import { DashboardShell, DashboardKPIGrid, DashboardAttentionList, DashboardTaskList, DashboardVisualization } from '../../../components/dashboard';
import type { DashboardRoleConfig } from '../config/dashboardConfig';
import type { DashboardResponse } from '../../../types/dashboard';

export function AdminDashboard({ data }: { config: DashboardRoleConfig, data?: DashboardResponse }) {
  return (
    <DashboardShell greeting="Organization Overview" subtitle="Here's your organization health.">
      <div className="space-y-6">
        <DashboardKPIGrid kpis={data?.summary_kpis || []} />
        <DashboardVisualization visualizations={data?.visualizations || []} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <DashboardTaskList tasks={data?.recent_tasks || []} title="Recent Activity" />
          <DashboardAttentionList items={data?.attention_items || []} />
        </div>
      </div>
    </DashboardShell>
  );
}
