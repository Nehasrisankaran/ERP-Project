import { useNavigate } from 'react-router-dom';
import type { Employee } from '../../../types';
import { Avatar } from '../../../components/ui';
import { cn } from '../../../utils';
import { MapPin, Mail, Phone, Shield, TrendingUp, CheckCircle2, AlertTriangle, Clock, Briefcase } from 'lucide-react';

interface Props { emp: Employee; directReports: Employee[]; activity: any[]; }

const WORKLOAD_CFG: Record<string, { bar: string; text: string }> = {
  Underutilized: { bar: 'bg-slate-300', text: 'text-slate-500' },
  Healthy:       { bar: 'bg-emerald-500', text: 'text-emerald-600' },
  High:          { bar: 'bg-amber-500',   text: 'text-amber-600'   },
  Overloaded:    { bar: 'bg-red-500',     text: 'text-red-600'     },
};

function StatCard({ icon, value, label, sub }: { icon: React.ReactNode; value: number | string; label: string; sub?: string }) {
  return (
    <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-3">
      <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 shadow-sm">{icon}</div>
      <div>
        <p className="text-lg font-bold text-slate-800 leading-tight">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
        {sub && <p className="text-[10px] text-slate-400">{sub}</p>}
      </div>
    </div>
  );
}

function ActivityItem({ item }: { item: any }) {
  const icons: Record<string, React.ReactNode> = {
    completed: <CheckCircle2 size={13} className="text-emerald-500" />,
    status_changed: <TrendingUp size={13} className="text-blue-500" />,
    assigned: <Shield size={13} className="text-violet-500" />,
    comment_added: <Mail size={13} className="text-slate-500" />,
    created: <Briefcase size={13} className="text-amber-500" />,
    default: <Clock size={13} className="text-slate-400" />,
  };
  const icon = icons[item.event_type] || icons.default;
  const time = new Date(item.created_at);
  const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-slate-50 last:border-0">
      <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center mt-0.5 flex-shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-700">{item.description}</p>
        {item.task_title && <p className="text-[11px] text-slate-400 truncate">on "{item.task_title}"</p>}
        {item.project_name && <p className="text-[11px] text-violet-500">{item.project_name}</p>}
      </div>
      <span className="text-[10px] text-slate-400 flex-shrink-0">{timeStr}</span>
    </div>
  );
}

export default function OverviewTab({ emp, directReports, activity }: Props) {
  const navigate = useNavigate();
  const wl = WORKLOAD_CFG[emp.workload_status || 'Healthy'];
  const pct = emp.workload_percentage || 0;

  return (
    <div className="grid grid-cols-3 gap-5">
      {/* Left column: Profile info */}
      <div className="space-y-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Profile</h3>
          <div className="space-y-3">
            {[
              { label: 'Job Title', value: emp.designation },
              { label: 'Department', value: emp.department_name },
              { label: 'Location', value: emp.location },
              { label: 'Joined', value: emp.date_joined ? new Date(emp.date_joined).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }) : null },
            ].filter(r => r.value).map(row => (
              <div key={row.label} className="flex items-start gap-2">
                <span className="text-xs text-slate-400 w-20 flex-shrink-0 mt-0.5">{row.label}</span>
                <span className="text-xs font-medium text-slate-700 capitalize">{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Contact */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Contact</h3>
          <div className="space-y-2.5">
            {emp.email && (
              <div className="flex items-center gap-2.5 text-xs text-slate-600">
                <Mail size={13} className="text-slate-400" /> {emp.email}
              </div>
            )}
            {emp.phone && (
              <div className="flex items-center gap-2.5 text-xs text-slate-600">
                <Phone size={13} className="text-slate-400" /> {emp.phone}
              </div>
            )}
            {emp.location && (
              <div className="flex items-center gap-2.5 text-xs text-slate-600">
                <MapPin size={13} className="text-slate-400" /> {emp.location}
              </div>
            )}
          </div>
        </div>

        {/* Manager */}
        {emp.manager_name && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Reports To</h3>
            <button
              onClick={() => emp.manager_id && navigate(`/people/${emp.manager_id}`)}
              className="flex items-center gap-3 w-full group text-left hover:bg-violet-50 rounded-xl p-2 -mx-2 transition-colors"
            >
              <Avatar name={emp.manager_name} size="md" />
              <div>
                <p className="text-sm font-semibold text-slate-800 group-hover:text-violet-700 transition-colors">{emp.manager_name}</p>
                <p className="text-xs text-slate-400">Manager</p>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* Middle column: Work summary + Workload + Activity */}
      <div className="space-y-4">
        {/* Work summary */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Work Summary</h3>
          <div className="grid grid-cols-2 gap-3">
            <StatCard icon={<TrendingUp size={16} />} value={emp.active_tasks_count ?? 0} label="Active Tasks" />
            <StatCard icon={<AlertTriangle size={16} />} value={emp.overdue_tasks_count ?? 0} label="Overdue" />
            <StatCard icon={<CheckCircle2 size={16} />} value={emp.completed_tasks_count ?? 0} label="Completed" />
            <StatCard icon={<Briefcase size={16} />} value={emp.active_projects_count ?? 0} label="Projects" />
          </div>
        </div>

        {/* Workload */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Workload</h3>
          <div className="text-center mb-4">
            <span className={cn('text-4xl font-extrabold', wl.text)}>{pct}%</span>
            <p className={cn('text-sm font-semibold mt-1', wl.text)}>{emp.workload_status}</p>
          </div>
          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden mb-3">
            <div className={cn('h-full rounded-full transition-all', wl.bar)} style={{ width: `${Math.min(pct, 100)}%` }} />
          </div>
          <div className="flex justify-between text-xs text-slate-400">
            <span>{emp.estimated_hours?.toFixed(0) ?? 0}h estimated</span>
            <span>40h capacity</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-2 text-center">
            Workload = estimated task hours ÷ weekly capacity
          </p>
        </div>
      </div>

      {/* Right column: Activity + Direct reports */}
      <div className="space-y-4">
        {/* Activity */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Recent Activity</h3>
          {activity.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">No recent activity.</p>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              {activity.slice(0, 10).map(a => <ActivityItem key={a.id} item={a} />)}
            </div>
          )}
        </div>

        {/* Direct reports */}
        {directReports.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
              Direct Reports ({directReports.length})
            </h3>
            <div className="space-y-2.5">
              {directReports.map(r => (
                <button
                  key={r.id}
                  onClick={() => navigate(`/people/${r.id}`)}
                  className="flex items-center gap-3 w-full group text-left hover:bg-violet-50 rounded-xl p-1.5 transition-colors"
                >
                  <Avatar name={r.full_name} src={r.avatar_url} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800 group-hover:text-violet-700 truncate">{r.full_name}</p>
                    <p className="text-[11px] text-slate-400 truncate">{r.designation}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium text-slate-600">{r.workload_percentage}%</p>
                    <p className="text-[10px] text-slate-400">{r.active_tasks_count} tasks</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
