import type { DashboardKPI } from '../../types/dashboard';
import { DashboardMetricCard } from './DashboardMetricCard';
import { Activity, CheckCircle, BarChart3, Users, Folder, Clock, Calendar, ShieldAlert } from 'lucide-react';

// Maps KPI labels/ids to appropriate generic icons and colors
function getKpiVisuals(kpi: DashboardKPI) {
  const id = kpi.id.toLowerCase();
  const label = kpi.label.toLowerCase();
  
  if (id.includes('today') || label.includes('today')) return { icon: <Calendar size={20} className="text-blue-500" />, color: 'bg-blue-50' };
  if (id.includes('overdue') || label.includes('overdue')) return { icon: <Clock size={20} className="text-red-500" />, color: 'bg-red-50' };
  if (id.includes('completed') || label.includes('completed')) return { icon: <CheckCircle size={20} className="text-emerald-500" />, color: 'bg-emerald-50' };
  if (id.includes('progress') || label.includes('progress') || label.includes('health')) return { icon: <Activity size={20} className="text-violet-500" />, color: 'bg-violet-50' };
  if (id.includes('team') || label.includes('team') || label.includes('employee')) return { icon: <Users size={20} className="text-indigo-500" />, color: 'bg-indigo-50' };
  if (id.includes('project') || label.includes('project')) return { icon: <Folder size={20} className="text-amber-500" />, color: 'bg-amber-50' };
  if (id.includes('risk') || label.includes('risk')) return { icon: <ShieldAlert size={20} className="text-orange-500" />, color: 'bg-orange-50' };

  return { icon: <BarChart3 size={20} className="text-slate-500" />, color: 'bg-slate-50' };
}

export function DashboardKPIGrid({ kpis }: { kpis: DashboardKPI[] }) {
  if (!kpis || kpis.length === 0) return null;
  
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {kpis.map(kpi => {
        const { icon, color } = getKpiVisuals(kpi);
        return (
          <DashboardMetricCard
            key={kpi.id}
            label={kpi.label}
            value={kpi.value}
            sub={kpi.trend}
            icon={icon}
            color={color}
          />
        );
      })}
    </div>
  );
}
