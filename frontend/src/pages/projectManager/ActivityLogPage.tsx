import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { projectManagerService } from '../../services/projectManagerService';
import { Activity, AlertTriangle, Clock } from 'lucide-react';

export default function ActivityLogPage() {
  const { data: logRes, isLoading, error, refetch } = useQuery({
    queryKey: ['pmActivityLogs'],
    queryFn: () => projectManagerService.getLogs().then((res) => res.data),
  });

  const logs = logRes?.logs || [];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Activity Log</h1>
          <p className="text-sm text-slate-500">System audit trail of background runs, syncs, reminders, and target updates</p>
        </div>
        <button
          onClick={() => refetch()}
          className="self-start md:self-auto px-4 py-2 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 font-medium text-sm rounded-lg shadow-sm"
        >
          Refresh Logs
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
          <p className="text-red-700 font-semibold mb-2">Unable to load activity logs.</p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium"
          >
            Retry
          </button>
        </div>
      ) : logs.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <Activity size={40} className="text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No activity recorded</h3>
          <p className="text-sm text-slate-500">System activities will be logged here.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="relative border-l-2 border-slate-200 ml-4 space-y-6">
            {logs.map((l: any, idx: number) => (
              <div key={idx} className="relative pl-6">
                <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-violet-600 ring-4 ring-white"></div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                  <span className="font-bold text-slate-900 text-sm">{l.event}</span>
                  <span className="text-xs font-mono text-slate-400">{l.timestamp}</span>
                </div>
                {l.detail && <p className="text-xs text-slate-600 font-mono bg-slate-50 p-2.5 rounded border border-slate-100">{l.detail}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
