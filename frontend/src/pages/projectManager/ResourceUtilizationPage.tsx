
import { useQuery } from '@tanstack/react-query';
import { projectManagerService } from '../../services/projectManagerService';
import { AlertTriangle, Activity } from 'lucide-react';

export default function ResourceUtilizationPage() {
  const { data: utilRes, isLoading, error, refetch } = useQuery({
    queryKey: ['pmUtilization'],
    queryFn: () => projectManagerService.getUtilization().then((res) => res.data),
  });

  if (isLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6 animate-pulse">
        <div className="h-8 bg-slate-200 rounded w-1/3"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-slate-200 rounded-xl"></div>
          ))}
        </div>
        <div className="h-64 bg-slate-200 rounded-xl"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <AlertTriangle size={32} className="text-red-500 mx-auto mb-2" />
          <p className="text-red-700 font-semibold mb-2">Unable to load utilization metrics.</p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const summary = utilRes?.summary || {};
  const devUtil = utilRes?.dev_utilization || [];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Resource Utilization</h1>
          <p className="text-sm text-slate-500">Live capacity and workload distribution metrics for engineering resources</p>
        </div>
        <button
          onClick={() => refetch()}
          className="self-start md:self-auto px-4 py-2 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 font-medium text-sm rounded-lg shadow-sm flex items-center gap-2"
        >
          <Activity size={16} className="text-violet-600" />
          <span>Refresh Metrics</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Active Developers</span>
          <div className="text-2xl font-bold text-slate-900 mt-2">{summary.active_dev_count || 0}</div>
          <p className="text-xs text-slate-500 mt-1">Engineers in tracker</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Average Team Efficiency</span>
          <div className="text-2xl font-bold text-violet-700 mt-2">{summary.average_efficiency || 0}%</div>
          <p className="text-xs text-slate-500 mt-1">Overall workload ratio</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Bench / Free Capacity</span>
          <div className="text-2xl font-bold text-emerald-700 mt-2">{summary.bench_capacity || 0}</div>
          <p className="text-xs text-slate-500 mt-1">Developers available for allocation</p>
        </div>
      </div>

      {/* Developer Utilization Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 font-bold text-slate-900">Developer Capacity Breakdown</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-semibold text-xs uppercase border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4">Developer</th>
                <th className="py-3.5 px-4">Active Tasks</th>
                <th className="py-3.5 px-4">Allocated Hours</th>
                <th className="py-3.5 px-4">Utilization %</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">PM Action Plan / Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {devUtil.map((d: any, idx: number) => {
                const pct = d['Utilization Percentage'] || 0;
                const status = d['Utilization Status'] || 'Normal';
                return (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      <div>{d['Developer']}</div>
                      {d['Email'] && <span className="text-xs text-slate-400 font-normal">{d['Email']}</span>}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 font-semibold">{d['Active Tasks Count']}</td>
                    <td className="py-3.5 px-4 text-slate-600 font-mono text-xs">{d['Total Allocated Hours']} hrs</td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-2 rounded-full ${
                              pct > 100 ? 'bg-red-500' : pct < 50 ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          ></div>
                        </div>
                        <span className="text-xs font-mono font-bold text-slate-700">{pct}%</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                          status.toLowerCase().includes('overload')
                            ? 'bg-red-100 text-red-800'
                            : status.toLowerCase().includes('bench') || status.toLowerCase().includes('under')
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 text-xs max-w-xs">{d['PM Action Plan / Bench Suggestion'] || '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
