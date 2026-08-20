import { useQuery } from '@tanstack/react-query';
import { peopleApi } from '../../../services/api';
import { Spinner } from '../../../components/ui';
import { cn } from '../../../utils';
import { CheckCircle2, TrendingUp, Shield, Mail, Briefcase, Clock, Flag } from 'lucide-react';

const EVENT_ICONS: Record<string, React.ReactNode> = {
  completed:      <CheckCircle2 size={13} className="text-emerald-500" />,
  status_changed: <TrendingUp size={13} className="text-blue-500" />,
  assigned:       <Shield size={13} className="text-violet-500" />,
  comment_added:  <Mail size={13} className="text-slate-500" />,
  created:        <Briefcase size={13} className="text-amber-500" />,
  reopened:       <Flag size={13} className="text-red-500" />,
};

function groupByDate(items: any[]) {
  const groups: Record<string, any[]> = {};
  for (const item of items) {
    const d = new Date(item.created_at);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    let label: string;
    if (d.toDateString() === today.toDateString()) label = 'Today';
    else if (d.toDateString() === yesterday.toDateString()) label = 'Yesterday';
    else label = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    if (!groups[label]) groups[label] = [];
    groups[label].push(item);
  }
  return groups;
}

export default function ActivityTab({ empId }: { empId: number }) {
  const { data: activity = [], isLoading } = useQuery<any[]>({
    queryKey: ['emp-activity', empId],
    queryFn: async () => { const r = await peopleApi.activity(empId, 50); return Array.isArray(r.data) ? r.data : []; },
  });

  if (isLoading) return <div className="flex justify-center py-12"><Spinner className="w-8 h-8" /></div>;

  if (activity.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
          <Clock size={22} className="text-slate-400" />
        </div>
        <p className="text-sm font-semibold text-slate-700">No activity yet</p>
        <p className="text-xs text-slate-400 mt-1">Activity will appear here as work progresses.</p>
      </div>
    );
  }

  const groups = groupByDate(activity);

  return (
    <div className="max-w-2xl">
      {Object.entries(groups).map(([date, items]) => (
        <div key={date} className="mb-6">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 sticky top-0 bg-[#f8f9fc] py-1">{date}</h3>
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            {items.map((item, idx) => {
              const icon = EVENT_ICONS[item.event_type] || <Clock size={13} className="text-slate-400" />;
              const time = new Date(item.created_at);
              const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              return (
                <div key={item.id} className={cn('flex items-start gap-3 px-4 py-3', idx < items.length - 1 ? 'border-b border-slate-50' : '')}>
                  <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center mt-0.5 flex-shrink-0">{icon}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700">{item.description}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {item.task_title && (
                        <span className="text-xs text-slate-400 truncate">"{item.task_title}"</span>
                      )}
                      {item.project_name && (
                        <span className="text-xs text-violet-500">· {item.project_name}</span>
                      )}
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-400 flex-shrink-0">{timeStr}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
