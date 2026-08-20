import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { peopleApi } from '../../../services/api';
import type { Task } from '../../../types';
import { Spinner } from '../../../components/ui';
import { cn } from '../../../utils';
import { AlertTriangle, Clock, CheckCircle2, ChevronRight, Flag } from 'lucide-react';

const PRIORITY_CFG: Record<string, { dot: string; label: string }> = {
  low:      { dot: 'bg-slate-400',   label: 'Low'      },
  medium:   { dot: 'bg-blue-500',    label: 'Medium'   },
  high:     { dot: 'bg-amber-500',   label: 'High'     },
  critical: { dot: 'bg-red-500',     label: 'Critical' },
};
const STATUS_CFG: Record<string, { text: string; label: string }> = {
  not_started: { text: 'text-slate-500',   label: 'To Do'       },
  in_progress: { text: 'text-blue-600',    label: 'In Progress' },
  in_review:   { text: 'text-violet-600',  label: 'In Review'   },
  blocked:     { text: 'text-red-600',     label: 'Blocked'     },
  completed:   { text: 'text-emerald-600', label: 'Done'        },
  cancelled:   { text: 'text-slate-400',   label: 'Cancelled'   },
};

function TaskRow({ task }: { task: Task }) {
  const navigate = useNavigate();
  const today = new Date().toISOString().split('T')[0];
  const isOverdue = task.due_date && task.due_date < today && !['completed','cancelled'].includes(task.status);
  const p = PRIORITY_CFG[task.priority] || PRIORITY_CFG.medium;
  const s = STATUS_CFG[task.status] || STATUS_CFG.not_started;

  return (
    <div
      onClick={() => navigate(`/projects/${task.project_id}?task=${task.id}`)}
      className="flex items-center gap-3 px-4 py-3 border-b border-slate-50 hover:bg-violet-50/40 cursor-pointer group transition-colors"
    >
      <span className={cn('w-2 h-2 rounded-full flex-shrink-0', p.dot)} title={p.label} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 group-hover:text-violet-700 truncate">{task.title}</p>
        <p className="text-xs text-slate-400 truncate">{task.project_name}</p>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <span className={cn('text-xs font-medium', s.text)}>{s.label}</span>
        {task.due_date && (
          <span className={cn('text-xs', isOverdue ? 'text-red-500 font-semibold' : 'text-slate-400')}>
            {isOverdue && <AlertTriangle size={11} className="inline mr-0.5" />}
            {new Date(task.due_date + 'T00:00:00').toLocaleDateString('en-IN', { day:'numeric', month:'short' })}
          </span>
        )}
        {task.estimated_hours && (
          <span className="text-xs text-slate-400">{task.estimated_hours}h</span>
        )}
      </div>
      <ChevronRight size={14} className="text-slate-300 group-hover:text-violet-500 transition-colors" />
    </div>
  );
}

function Section({ title, icon, tasks, empty }: { title: string; icon: React.ReactNode; tasks: Task[]; empty: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50/60">
        <span className="text-slate-400">{icon}</span>
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        <span className="ml-auto text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{tasks.length}</span>
      </div>
      {tasks.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-6">{empty}</p>
      ) : (
        tasks.map(t => <TaskRow key={t.id} task={t} />)
      )}
    </div>
  );
}

export default function WorkTab({ empId }: { empId: number }) {
  const { data: allTasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ['emp-tasks', empId],
    queryFn: async () => { const r = await peopleApi.tasks(empId); return Array.isArray(r.data) ? r.data : []; },
  });

  if (isLoading) return <div className="flex justify-center py-12"><Spinner className="w-8 h-8" /></div>;

  const today = new Date().toISOString().split('T')[0];
  const active = allTasks.filter(t => !['completed','cancelled'].includes(t.status) && !(t.due_date && t.due_date < today));
  const overdue = allTasks.filter(t => t.due_date && t.due_date < today && !['completed','cancelled'].includes(t.status));
  const completed = allTasks.filter(t => t.status === 'completed');
  const blocked = allTasks.filter(t => t.status === 'blocked');

  const activeEst = active.concat(overdue).reduce((s, t) => s + (t.estimated_hours || 4), 0);
  const pct = Math.min(Math.round((activeEst / 40) * 100), 200);

  return (
    <div className="space-y-5">
      {/* Workload summary */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Active', value: active.length, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Overdue', value: overdue.length, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Blocked', value: blocked.length, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Completed', value: completed.length, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        ].map(s => (
          <div key={s.label} className={cn('rounded-2xl p-4 flex flex-col items-center', s.bg)}>
            <span className={cn('text-2xl font-bold', s.color)}>{s.value}</span>
            <span className={cn('text-xs font-medium mt-0.5', s.color)}>{s.label}</span>
          </div>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-700">Current Utilization</h3>
          <span className="text-lg font-bold text-slate-800">{pct}%</span>
        </div>
        <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full', pct > 100 ? 'bg-red-500' : pct > 75 ? 'bg-amber-500' : pct > 30 ? 'bg-emerald-500' : 'bg-slate-300')}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-slate-400 mt-2">
          <span>{activeEst.toFixed(0)}h estimated work</span>
          <span>40h weekly capacity</span>
        </div>
      </div>

      <Section title="Active & Upcoming" icon={<Clock size={15} />} tasks={active} empty="No active tasks. You're all caught up!" />
      {overdue.length > 0 && <Section title="Overdue" icon={<AlertTriangle size={15} />} tasks={overdue} empty="" />}
      {blocked.length > 0 && <Section title="Blocked" icon={<Flag size={15} />} tasks={blocked} empty="" />}
      <Section title="Recently Completed" icon={<CheckCircle2 size={15} />} tasks={completed.slice(0, 10)} empty="No completed tasks yet." />
    </div>
  );
}
