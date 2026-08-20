
import { useQuery } from '@tanstack/react-query';
import { projectManagerService } from '../../services/projectManagerService';
import { 
  FolderKanban, CheckCircle2, Clock, AlertTriangle, 
  Users, Layers, Activity, TrendingUp, BarChart3, AlertOctagon, CheckSquare, Target
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

function StatCard({ title, value, icon, trend, subtext, colorClass }: any) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow group cursor-default">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</span>
        <div className={`p-2 rounded-lg ${colorClass}`}>
          {icon}
        </div>
      </div>
      <div className="flex items-end gap-3">
        <div className="text-3xl font-bold text-slate-900">{value}</div>
        {trend && (
          <div className={`text-xs font-medium mb-1 ${trend.includes('+') || trend.includes('↑') ? 'text-emerald-600' : 'text-red-600'}`}>
            {trend}
          </div>
        )}
      </div>
      {subtext && <p className="text-xs text-slate-500 mt-1.5">{subtext}</p>}
    </div>
  );
}

export default function PMOverviewPage() {
  const navigate = useNavigate();

  const { data: summaryRes, isLoading, error, refetch } = useQuery({
    queryKey: ['pmSummary'],
    queryFn: () => projectManagerService.getSummary().then(res => res.data),
  });

  const { data: utilData } = useQuery({
    queryKey: ['pmUtilization'],
    queryFn: () => projectManagerService.getUtilization().then(res => res.data),
  });

  const { data: pendingTasks } = useQuery({
    queryKey: ['pmPendingToday'],
    queryFn: () => projectManagerService.getPendingTasks().then(res => res.data),
  });

  if (isLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6 animate-pulse">
        <div className="h-10 bg-slate-200 rounded w-1/3"></div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="h-32 bg-slate-200 rounded-xl"></div>
          ))}
        </div>
        <div className="h-64 bg-slate-200 rounded-xl"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center flex flex-col items-center">
          <AlertTriangle size={48} className="text-red-500 mb-4" />
          <h3 className="text-xl font-bold text-red-800 mb-2">Dashboard Error</h3>
          <p className="text-sm text-red-600 mb-6 max-w-md">We couldn't connect to the Project Manager API. Please ensure you are logged in and try again.</p>
          <button
            onClick={() => refetch()}
            className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  const byCat = summaryRes?.by_category || {};
  const byProj = summaryRes?.by_project || {};

  const totalTasks = summaryRes?.total_tasks || 0;
  const overdue = byCat.overdue || 0;
  const dueToday = byCat.due_today || 0;
  const inProgress = byCat.in_progress || 0;
  const yetToStart = byCat.yet_to_start || 0;
  const completed = byCat.completed_or_other || 0;
  
  const activeProjectsCount = Object.keys(byProj).length;
  const pendingTotal = overdue + dueToday + inProgress + yetToStart;

  let overallUtil = 0;
  if (utilData?.heatmap) {
    const totalAlloc = Object.values(utilData.heatmap).reduce((acc: number, cur: any) => acc + (cur.allocated || 0), 0) as number;
    const totalCap = Object.values(utilData.heatmap).reduce((acc: number, cur: any) => acc + (cur.capacity || 0), 0) as number;
    overallUtil = totalCap > 0 ? Math.round((totalAlloc / totalCap) * 100) : 0;
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">Project Intelligence</h1>
          <p className="text-sm text-slate-500">Real-time workload, delivery risks, and resource utilization</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-slate-100 rounded-lg p-1 hidden sm:flex">
            <button className="px-3 py-1.5 text-xs font-medium rounded-md bg-white text-slate-800 shadow-sm">Today</button>
            <button className="px-3 py-1.5 text-xs font-medium rounded-md text-slate-500 hover:text-slate-700">This Week</button>
            <button className="px-3 py-1.5 text-xs font-medium rounded-md text-slate-500 hover:text-slate-700">This Month</button>
          </div>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 font-medium text-sm rounded-lg shadow-sm transition-all flex items-center gap-2"
          >
            <Activity size={16} className="text-violet-600" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Active Projects" value={activeProjectsCount} icon={<FolderKanban size={20} />} colorClass="bg-violet-100 text-violet-700" subtext="Live tracking via SharePoint" />
        <StatCard title="Total Tasks" value={totalTasks} icon={<Layers size={20} />} colorClass="bg-blue-100 text-blue-700" subtext="Across all environments" />
        <StatCard title="Completed" value={completed} icon={<CheckCircle2 size={20} />} colorClass="bg-emerald-100 text-emerald-700" subtext={`${Math.round((completed/totalTasks)*100 || 0)}% completion rate`} />
        <StatCard title="Pending" value={pendingTotal} icon={<CheckSquare size={20} />} colorClass="bg-slate-100 text-slate-700" subtext="In progress or not started" />
        
        <StatCard title="Due Today" value={dueToday} icon={<Clock size={20} />} colorClass="bg-amber-100 text-amber-700" subtext="Immediate attention" />
        <StatCard title="Overdue Tasks" value={overdue} icon={<AlertOctagon size={20} />} colorClass="bg-red-100 text-red-700" subtext="Delivery at risk" />
        <StatCard title="Milestones at Risk" value={"--"} icon={<Target size={20} />} colorClass="bg-orange-100 text-orange-700" subtext="Calculated from delays" />
        <StatCard title="Team Utilization" value={`${overallUtil}%`} icon={<Users size={20} />} colorClass="bg-indigo-100 text-indigo-700" subtext="Aggregate team bandwidth" />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Project Health Overview */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <BarChart3 size={18} className="text-violet-600" />
                Project Health
              </h2>
              <button className="text-xs font-medium text-violet-600 hover:text-violet-700">View All</button>
            </div>
            <div className="p-6">
              <div className="space-y-6">
                {Object.entries(byProj).map(([projName, cats]: [string, any]) => {
                  const pTotal = (cats.completed_or_other || 0) + (cats.overdue || 0) + (cats.due_today || 0) + (cats.in_progress || 0) + (cats.yet_to_start || 0);
                  const pComp = cats.completed_or_other || 0;
                  const percent = pTotal > 0 ? Math.round((pComp / pTotal) * 100) : 0;

                  return (
                    <div key={projName} className="group">
                      <div className="flex justify-between items-end mb-2">
                        <div>
                          <h4 className="text-sm font-bold text-slate-800 mb-0.5 group-hover:text-violet-700 transition-colors cursor-pointer">{projName}</h4>
                          <div className="flex gap-3 text-[11px] font-medium text-slate-500">
                            <span>{pTotal} Tasks</span>
                            {cats.overdue > 0 && <span className="text-red-600">{cats.overdue} Overdue</span>}
                            {cats.due_today > 0 && <span className="text-amber-600">{cats.due_today} Due Today</span>}
                            <span>{cats.in_progress || 0} In Progress</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-bold text-slate-700">{percent}%</span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden flex">
                        <div className="bg-emerald-500 h-full transition-all duration-500" style={{ width: `${percent}%` }} title="Completed"></div>
                        <div className="bg-red-500 h-full" style={{ width: `${pTotal ? ((cats.overdue || 0) / pTotal) * 100 : 0}%` }} title="Overdue"></div>
                        <div className="bg-amber-400 h-full" style={{ width: `${pTotal ? ((cats.due_today || 0) / pTotal) * 100 : 0}%` }} title="Due Today"></div>
                        <div className="bg-blue-400 h-full" style={{ width: `${pTotal ? ((cats.in_progress || 0) / pTotal) * 100 : 0}%` }} title="In Progress"></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          
          {/* Pending Today section */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
             <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Clock size={18} className="text-amber-600" />
                Pending Today
              </h2>
              <button onClick={() => navigate('/project-manager/pending-today')} className="text-xs font-medium text-violet-600 hover:text-violet-700">View All</button>
            </div>
            <div className="p-0">
              {!pendingTasks || (Array.isArray(pendingTasks) ? pendingTasks : (pendingTasks as any).tasks || []).length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-sm">No tasks pending for today. You're all caught up!</div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {(Array.isArray(pendingTasks) ? pendingTasks : (pendingTasks as any).tasks || []).slice(0, 5).map((task: any, idx: number) => (
                    <li key={idx} className="p-4 hover:bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-slate-800 line-clamp-1">{task.task_name}</p>
                        <p className="text-xs font-medium text-slate-500">{task.project_name} • Assignee: {task.assignee}</p>
                      </div>
                      <div className="flex-shrink-0">
                        <span className="inline-flex items-center px-2 py-1 rounded text-[10px] font-bold bg-amber-100 text-amber-800 uppercase tracking-wider">
                          {task.status || 'Due Today'}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Delivery Risks */}
          <div className="bg-white border border-red-200 rounded-xl shadow-sm overflow-hidden relative">
            <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle size={18} className="text-red-600" />
                Delivery Risks
              </h2>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-slate-700">Overdue Tasks</span>
                  <span className="text-sm font-bold text-red-600">{overdue}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-slate-700">Delayed Milestones</span>
                  <span className="text-sm font-bold text-orange-600">--</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-slate-700">Sprints at Risk</span>
                  <span className="text-sm font-bold text-amber-600">--</span>
                </div>
              </div>
              <button onClick={() => navigate('/project-manager/delivery-risks')} className="w-full mt-6 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-sm font-medium text-slate-700 rounded-lg transition-colors">
                Investigate Risks
              </button>
            </div>
          </div>

          {/* Task Status Analytics */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <TrendingUp size={18} className="text-blue-600" />
                Task Status
              </h2>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {[
                  { label: 'Completed', count: completed, color: 'bg-emerald-500', text: 'text-emerald-700' },
                  { label: 'In Progress', count: inProgress, color: 'bg-blue-500', text: 'text-blue-700' },
                  { label: 'Due Today', count: dueToday, color: 'bg-amber-400', text: 'text-amber-700' },
                  { label: 'Overdue', count: overdue, color: 'bg-red-500', text: 'text-red-700' },
                  { label: 'Not Started', count: yetToStart, color: 'bg-slate-300', text: 'text-slate-600' },
                ].map(stat => (
                  <div key={stat.label}>
                    <div className="flex justify-between text-xs font-semibold mb-1.5">
                      <span className={stat.text}>{stat.label}</span>
                      <span className="text-slate-600">{stat.count} <span className="text-slate-400 font-normal ml-1">({totalTasks ? Math.round((stat.count / totalTasks) * 100) : 0}%)</span></span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div className={`${stat.color} h-full rounded-full`} style={{ width: `${totalTasks ? (stat.count / totalTasks) * 100 : 0}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
