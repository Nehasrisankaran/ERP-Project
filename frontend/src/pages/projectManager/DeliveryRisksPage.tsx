
import { useQuery } from '@tanstack/react-query';
import { projectManagerService } from '../../services/projectManagerService';
import { AlertTriangle, Clock, User, ShieldAlert } from 'lucide-react';

export default function DeliveryRisksPage() {
  const { data: tasksRes, isLoading, error, refetch } = useQuery({
    queryKey: ['pmDeliveryRisks'],
    queryFn: () => projectManagerService.getTasks().then((res) => res.data),
  });

  const tasks = tasksRes?.tasks || [];
  const today = new Date();

  const delayedTasks = tasks.filter((t: any) => {
    if (!t.eta) return false;
    const isCompleted = t.status?.toLowerCase().includes('complete') || t.status?.toLowerCase().includes('done');
    if (isCompleted) return false;
    const etaDate = new Date(t.eta);
    return etaDate < today;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Delivery & Sprint Delays</h1>
          <p className="text-sm text-slate-500">Real-time identification of overdue work packages endangering project delivery</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm font-semibold">
          <ShieldAlert size={18} />
          <span>{delayedTasks.length} Delayed Tasks Detected</span>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center animate-pulse space-y-4">
          <div className="h-6 bg-slate-200 rounded w-1/4 mx-auto"></div>
          <div className="h-4 bg-slate-200 rounded w-1/3 mx-auto"></div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <AlertTriangle size={32} className="text-red-500 mx-auto mb-2" />
          <p className="text-red-700 font-semibold mb-2">Unable to load delay details.</p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium"
          >
            Retry
          </button>
        </div>
      ) : delayedTasks.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <Clock size={40} className="text-emerald-500 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">Zero Delivery Delays!</h3>
          <p className="text-sm text-slate-500">All tasks with configured ETAs are currently on schedule or completed.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 font-semibold text-xs uppercase border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">Delayed Task</th>
                  <th className="py-3.5 px-4">Project</th>
                  <th className="py-3.5 px-4">Assignee</th>
                  <th className="py-3.5 px-4">Due Date (ETA)</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Remarks / Cause</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {delayedTasks.map((t: any, idx: number) => (
                  <tr key={t.row_id || idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      <div>{t.task}</div>
                      {t.module && t.module !== '-' && (
                        <span className="text-xs text-slate-400 font-normal">Module: {t.module}</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">
                      <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-xs font-medium">
                        {t.project}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-800 flex items-center gap-1.5">
                      <User size={14} className="text-slate-400" />
                      <span>{t.assignee}</span>
                    </td>
                    <td className="py-3.5 px-4 text-red-600 font-mono font-bold text-xs">{t.eta_str}</td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                        {t.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 text-xs max-w-xs">{t.remarks !== '-' ? t.remarks : 'No remarks logged'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
