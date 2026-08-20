import { DashboardShell, DashboardKPIGrid, DashboardAttentionList, DashboardTaskList, DashboardVisualization } from '../../../components/dashboard';
import type { DashboardRoleConfig } from '../config/dashboardConfig';
import type { DashboardResponse } from '../../../types/dashboard';

export function ProjectManagerDashboard({ data }: { config: DashboardRoleConfig, data?: DashboardResponse }) {
  return (
    <DashboardShell greeting="Project Delivery" subtitle="Here's your delivery and milestone health.">
      <div className="space-y-6">
        <DashboardKPIGrid kpis={data?.summary_kpis || []} />
        <DashboardVisualization visualizations={data?.visualizations || []} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <DashboardTaskList tasks={data?.recent_tasks || []} title="Recent Delivery Tasks" />
          <DashboardAttentionList items={data?.attention_items || []} />
        </div>
      </div>
    </DashboardShell>
  );
}
