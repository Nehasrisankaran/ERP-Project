import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectManagerService } from '../../services/projectManagerService';
import { Send, AlertTriangle, CheckCircle2, User, RefreshCw } from 'lucide-react';

export default function PendingTodayPage() {
  const queryClient = useQueryClient();
  const [reminderMsg, setReminderMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { data: pendingRes, isLoading, error, refetch } = useQuery({
    queryKey: ['pmPendingTasks'],
    queryFn: () => projectManagerService.getPendingTasks().then((res) => res.data),
  });

  const sendReminderMutation = useMutation({
    mutationFn: () => projectManagerService.sendReminders(),
    onSuccess: (res) => {
      setReminderMsg({
        type: 'success',
        text: res.data?.message || 'Teams reminder run triggered successfully in background.',
      });
      queryClient.invalidateQueries({ queryKey: ['pmPendingTasks'] });
    },
    onError: (err: any) => {
      setReminderMsg({
        type: 'error',
        text: err?.response?.data?.detail || err?.message || 'Failed to send reminders.',
      });
    },
  });

  const pendingTasks = pendingRes?.tasks || [];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Pending Today</h1>
          <p className="text-sm text-slate-500">Tasks requiring immediate attention, completion, or status updates today</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => sendReminderMutation.mutate()}
            disabled={sendReminderMutation.isPending}
            className="px-4 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-400 text-white font-medium text-sm rounded-lg shadow-sm transition-colors flex items-center gap-2"
          >
            {sendReminderMutation.isPending ? (
              <RefreshCw size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
            <span>Send Reminders</span>
          </button>
        </div>
      </div>

      {/* Reminder Status Alert */}
      {reminderMsg && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-sm ${
            reminderMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {reminderMsg.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            <span>{reminderMsg.text}</span>
          </div>
          <button onClick={() => setReminderMsg(null)} className="font-bold text-xs">
            Dismiss
          </button>
        </div>
      )}

      {/* Main Content */}
      {isLoading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center animate-pulse space-y-4">
          <div className="h-6 bg-slate-200 rounded w-1/4 mx-auto"></div>
          <div className="h-4 bg-slate-200 rounded w-1/3 mx-auto"></div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <AlertTriangle size={32} className="text-red-500 mx-auto mb-2" />
          <p className="text-red-700 font-semibold mb-2">Unable to load pending tasks.</p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium"
          >
            Retry
          </button>
        </div>
      ) : pendingTasks.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <CheckCircle2 size={40} className="text-emerald-500 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No pending tasks for today!</h3>
          <p className="text-sm text-slate-500">All assigned work is on track or completed.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 font-semibold text-xs uppercase border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">Employee</th>
                  <th className="py-3.5 px-4">Pending Task</th>
                  <th className="py-3.5 px-4">Project</th>
                  <th className="py-3.5 px-4">Due Date</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {pendingTasks.map((t: any, idx: number) => {
                  const isOverdue = t.category === 'overdue';
                  return (
                    <tr key={t.row_id || idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-slate-900 flex items-center gap-2">
                        <User size={16} className="text-slate-400" />
                        <span>{t.assignee}</span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-800">
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
                      <td className="py-3.5 px-4 text-slate-600 font-mono text-xs">{t.eta_str || '-'}</td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                            isOverdue ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {isOverdue ? 'Overdue' : 'Due Today'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 text-xs">{t.status}</td>
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
