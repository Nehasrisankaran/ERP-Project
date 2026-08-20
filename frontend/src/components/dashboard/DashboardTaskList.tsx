import type { DashboardTaskItem } from '../../types/dashboard';
import { CheckCircle2, Circle, Clock } from 'lucide-react';

export function DashboardTaskList({ tasks, title = "Recent Tasks" }: { tasks: DashboardTaskItem[], title?: string }) {
  if (!tasks || tasks.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500 h-full flex flex-col items-center justify-center">
        <p className="font-medium text-sm">No tasks to display</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm h-full flex flex-col">
      <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex-shrink-0">
        <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
          <CheckCircle2 size={16} className="text-violet-500" />
          {title}
        </h3>
      </div>
      <div className="divide-y divide-slate-100 flex-grow overflow-y-auto">
        {tasks.map(t => (
          <div key={t.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
            <div className="flex items-center gap-3">
              {t.status === 'completed' ? (
                <CheckCircle2 size={18} className="text-emerald-500 flex-shrink-0" />
              ) : (
                <Circle size={18} className="text-slate-300 flex-shrink-0" />
              )}
              <div>
                <div className="text-sm font-medium text-slate-700">
                  {t.title}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                  <span className="capitalize px-1.5 py-0.5 bg-slate-100 rounded text-slate-600 font-medium">{t.priority}</span>
                  {t.due_date && (
                    <span className="flex items-center gap-1">
                      <Clock size={12} /> {t.due_date}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
