
import { useQuery } from '@tanstack/react-query';
import { projectManagerService } from '../../services/projectManagerService';


export default function ExecutiveSummaryPage() {
  const { data: summaryRes, isLoading: loadingSummary } = useQuery({
    queryKey: ['pmExecutiveSummary'],
    queryFn: () => projectManagerService.getSummary().then((res) => res.data),
  });

  const { data: utilRes, isLoading: loadingUtil } = useQuery({
    queryKey: ['pmExecutiveUtil'],
    queryFn: () => projectManagerService.getUtilization().then((res) => res.data),
  });

  const isLoading = loadingSummary || loadingUtil;

  const byCat = summaryRes?.by_category || {};
  const byProj = summaryRes?.by_project || {};
  const utilSummary = utilRes?.summary || {};


  const overdue = byCat.overdue || 0;
  const dueToday = byCat.due_today || 0;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Executive Summary</h1>
        <p className="text-sm text-slate-500">High-level strategic snapshot of project health, overdue work, and team workload efficiency</p>
      </div>

      {isLoading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center animate-pulse space-y-4">
          <div className="h-6 bg-slate-200 rounded w-1/4 mx-auto"></div>
          <div className="h-4 bg-slate-200 rounded w-1/3 mx-auto"></div>
        </div>
      ) : (
        <>
          {/* Top Key Performance Indicators */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Projects</span>
              <div className="text-3xl font-bold text-slate-900 mt-2">{Object.keys(byProj).length}</div>
              <p className="text-xs text-slate-500 mt-1">Sheets in SharePoint tracker</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <span className="text-xs font-semibold text-red-600 uppercase tracking-wider">Critical Overdue Work</span>
              <div className="text-3xl font-bold text-red-700 mt-2">{overdue}</div>
              <p className="text-xs text-red-600 mt-1">Requires executive intervention</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Due Today</span>
              <div className="text-3xl font-bold text-amber-700 mt-2">{dueToday}</div>
              <p className="text-xs text-amber-600 mt-1">Pending delivery today</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <span className="text-xs font-semibold text-violet-600 uppercase tracking-wider">Team Efficiency</span>
              <div className="text-3xl font-bold text-violet-700 mt-2">{utilSummary.average_efficiency || 0}%</div>
              <p className="text-xs text-slate-500 mt-1">Workload utilization ratio</p>
            </div>
          </div>

          {/* Project Status Overview */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 mb-4">Project Health Overview</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 font-semibold text-xs uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Project Name</th>
                    <th className="py-3 px-4">Overdue</th>
                    <th className="py-3 px-4">Due Today</th>
                    <th className="py-3 px-4">In Progress</th>
                    <th className="py-3 px-4">Health Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {Object.entries(byProj).map(([projName, cats]: [string, any]) => {
                    const isHighRisk = (cats.overdue || 0) > 0;
                    return (
                      <tr key={projName} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-900">{projName}</td>
                        <td className="py-3 px-4 font-bold text-red-600">{cats.overdue || 0}</td>
                        <td className="py-3 px-4 font-bold text-amber-600">{cats.due_today || 0}</td>
                        <td className="py-3 px-4 text-blue-600">{cats.in_progress || 0}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-bold ${
                              isHighRisk ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {isHighRisk ? 'At Risk' : 'On Track'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
