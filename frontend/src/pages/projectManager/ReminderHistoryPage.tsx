
import { useQuery } from '@tanstack/react-query';
import { projectManagerService } from '../../services/projectManagerService';
import { History, AlertTriangle } from 'lucide-react';

export default function ReminderHistoryPage() {
  const { data: historyRes, isLoading, error, refetch } = useQuery({
    queryKey: ['pmReminderHistory'],
    queryFn: () => projectManagerService.getReminderHistory().then((res) => res.data),
  });

  const history = historyRes?.history || [];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Reminder History</h1>
          <p className="text-sm text-slate-500">Audit log of automated and manual Teams reminder dispatches</p>
        </div>
        <button
          onClick={() => refetch()}
          className="self-start md:self-auto px-4 py-2 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 font-medium text-sm rounded-lg shadow-sm"
        >
          Refresh History
        </button>
      </div>

      {isLoading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center animate-pulse space-y-4">
          <div className="h-6 bg-slate-200 rounded w-1/4 mx-auto"></div>
          <div className="h-4 bg-slate-200 rounded w-1/3 mx-auto"></div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <AlertTriangle size={32} className="text-red-500 mx-auto mb-2" />
          <p className="text-red-700 font-semibold mb-2">Unable to load reminder history.</p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium"
          >
            Retry
          </button>
        </div>
      ) : history.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <History size={40} className="text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No reminder history logged</h3>
          <p className="text-sm text-slate-500">Sent reminders will be recorded here.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 font-semibold text-xs uppercase border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">Sent Time</th>
                  <th className="py-3.5 px-4">Employee</th>
                  <th className="py-3.5 px-4">Email</th>
                  <th className="py-3.5 px-4">Task Count</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Delivery Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {history.map((h: any, idx: number) => {
                  const isSuccess = h.status === 'sent' || h.status === 'ok' || h.status === 'success';
                  return (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-500">{h.sent_at}</td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900">{h.assignee}</td>
                      <td className="py-3.5 px-4 text-slate-600 text-xs font-mono">{h.email}</td>
                      <td className="py-3.5 px-4 font-bold text-slate-800">{h.task_count}</td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                            isSuccess ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {h.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 text-xs max-w-xs">{h.error_detail || h.subject || 'Direct Teams DM'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
