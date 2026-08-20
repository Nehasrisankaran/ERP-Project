import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { projectManagerService } from '../../services/projectManagerService';
import { Spinner, Badge } from '../../components/ui';
import {
  FileText,
  Users,
  Diamond,
  Bell,
  ShieldAlert,
  BarChart3,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<
    'executive' | 'risks' | 'utilization' | 'milestones' | 'reminders'
  >('executive');

  const { data: execData, isLoading: execLoading } = useQuery({
    queryKey: ['pmExecSummary'],
    queryFn: async () => (await projectManagerService.getExecutiveSummary()).data,
  });

  const { data: risksData, isLoading: risksLoading } = useQuery({
    queryKey: ['pmRisks'],
    queryFn: async () => (await projectManagerService.getDeliveryRisks()).data,
  });

  const { data: utilData, isLoading: utilLoading } = useQuery({
    queryKey: ['pmUtilization'],
    queryFn: async () => (await projectManagerService.getResourceUtilization()).data,
  });

  const { data: milestoneData, isLoading: milestoneLoading } = useQuery({
    queryKey: ['pmMilestones'],
    queryFn: async () => (await projectManagerService.getMilestones()).data,
  });

  const { data: reminderData, isLoading: reminderLoading } = useQuery({
    queryKey: ['pmReminders'],
    queryFn: async () => (await projectManagerService.getReminderHistory()).data,
  });

  return (
    <div className="w-full px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-violet-50 text-violet-700 rounded-lg">
              <BarChart3 size={20} />
            </span>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Reports & Analytics</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Executive summaries, delivery risks, resource utilization, and milestone tracking.
              </p>
            </div>
          </div>
        </div>

        {/* Quick Stat Highlights */}
        <div className="flex items-center gap-3">
          <div className="bg-white border border-slate-200 rounded-xl px-4 py-2 flex items-center gap-3 shadow-2xs">
            <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-md">
              <CheckCircle2 size={16} />
            </span>
            <div>
              <p className="text-[10px] text-slate-400 font-semibold uppercase">Completion Rate</p>
              <p className="text-sm font-bold text-slate-800">88.4%</p>
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl px-4 py-2 flex items-center gap-3 shadow-2xs">
            <span className="p-1.5 bg-amber-50 text-amber-600 rounded-md">
              <AlertTriangle size={16} />
            </span>
            <div>
              <p className="text-[10px] text-slate-400 font-semibold uppercase">Risk Exposure</p>
              <p className="text-sm font-bold text-slate-800">Low</p>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-px">
        {[
          { key: 'executive', label: 'Executive Summary', icon: <FileText size={15} /> },
          { key: 'risks', label: 'Delivery Risks', icon: <ShieldAlert size={15} /> },
          { key: 'utilization', label: 'Resource Utilization', icon: <Users size={15} /> },
          { key: 'milestones', label: 'Milestones', icon: <Diamond size={15} /> },
          { key: 'reminders', label: 'Reminder Analytics', icon: <Bell size={15} /> },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all ${
              activeTab === tab.key
                ? 'bg-violet-50 text-violet-700 border-b-2 border-violet-600 shadow-2xs'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Main Tab Panels */}
      <div className="space-y-6">
        {activeTab === 'executive' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            {execLoading ? (
              <div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div>
            ) : !execData ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                <AlertTriangle size={32} className="text-amber-500 mb-3" />
                <p>Unable to load executive summary data.</p>
                <button onClick={() => window.location.reload()} className="mt-4 text-sm font-medium text-violet-600 hover:text-violet-700">Refresh Page</button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs hover:shadow-md transition-shadow">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Total Tasks</p>
                    <p className="text-3xl font-bold text-slate-800">{execData.total_tasks || 0}</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs hover:shadow-md transition-shadow">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Completed / Tracked</p>
                    <p className="text-3xl font-bold text-emerald-600">{execData.by_category?.completed_or_other || 0}</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs hover:shadow-md transition-shadow">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Yet to Start</p>
                    <p className="text-3xl font-bold text-blue-600">{execData.by_category?.yet_to_start || 0}</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs hover:shadow-md transition-shadow">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Overdue Risks</p>
                    <p className="text-3xl font-bold text-red-600">{execData.by_category?.overdue || 0}</p>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <h3 className="text-base font-bold text-slate-900">Project Breakdown</h3>
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Live Synced</Badge>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                    {execData.by_project && Object.entries(execData.by_project).map(([project, stats]: [string, any]) => (
                      <div key={project} className="p-4 rounded-xl border border-slate-100 bg-slate-50 space-y-3">
                        <p className="font-bold text-slate-800 truncate">{project}</p>
                        <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                          <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${Math.round(((stats.completed_or_other || 0) / ((stats.completed_or_other || 0) + (stats.yet_to_start || 0) + (stats.overdue || 0))) * 100) || 0}%` }}></div>
                        </div>
                        <div className="flex items-center justify-between text-sm pt-1">
                          <span className="text-slate-500">Completed</span>
                          <span className="font-semibold text-emerald-600">{stats.completed_or_other || 0}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-500">Pending</span>
                          <span className="font-semibold text-blue-600">{stats.yet_to_start || 0}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-500">Overdue</span>
                          <span className="font-semibold text-red-600">{stats.overdue || 0}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'risks' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            {risksLoading ? (
              <div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div>
            ) : !risksData || !risksData.tasks ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-12 shadow-xs text-center">
                <CheckCircle2 size={48} className="text-emerald-500 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-slate-800 mb-1">No delivery risks found</h3>
                <p className="text-slate-500 text-sm">All tracked deliverables are currently healthy.</p>
              </div>
            ) : (
              <>
                {/* Risk Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="bg-red-50 border border-red-100 rounded-2xl p-5">
                    <p className="text-xs font-bold text-red-600 uppercase tracking-wider mb-1">Total Risks</p>
                    <p className="text-3xl font-bold text-red-700">{risksData.count || risksData.tasks.length || 0}</p>
                    <p className="text-[10px] text-red-500 font-medium mt-1">Tasks requiring attention</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl p-5">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Overdue</p>
                    <p className="text-2xl font-bold text-slate-800">{risksData.tasks.filter((t: any) => t.category === 'overdue' || t.status === 'overdue').length}</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl p-5">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Delayed</p>
                    <p className="text-2xl font-bold text-slate-800">{risksData.tasks.filter((t: any) => t.status?.includes('delay')).length}</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl p-5">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Yet to Start</p>
                    <p className="text-2xl font-bold text-slate-800">{risksData.tasks.filter((t: any) => t.category === 'yet_to_start').length}</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl p-5">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Blocked</p>
                    <p className="text-2xl font-bold text-slate-800">{risksData.tasks.filter((t: any) => t.status === 'blocked').length}</p>
                  </div>
                </div>

                {/* Risks Table */}
                <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                    <h3 className="text-base font-bold text-slate-900">Task Delivery Risks</h3>
                    <div className="flex gap-2">
                      <select className="text-xs border-slate-200 rounded-md py-1.5 pl-3 pr-8 focus:ring-violet-500 focus:border-violet-500">
                        <option>All Projects</option>
                      </select>
                      <select className="text-xs border-slate-200 rounded-md py-1.5 pl-3 pr-8 focus:ring-violet-500 focus:border-violet-500">
                        <option>All Statuses</option>
                      </select>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 text-slate-500 font-medium text-xs uppercase tracking-wider border-b border-slate-200">
                        <tr>
                          <th className="py-3 px-6">Risk</th>
                          <th className="py-3 px-6 min-w-[250px]">Task Details</th>
                          <th className="py-3 px-6">Project / Module</th>
                          <th className="py-3 px-6">Assignee</th>
                          <th className="py-3 px-6">ETA</th>
                          <th className="py-3 px-6 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                        {risksData.tasks.map((task: any, i: number) => {
                          const isHighRisk = task.category === 'overdue';
                          return (
                            <tr key={i} className="hover:bg-slate-50/70 transition-colors group cursor-pointer">
                              <td className="py-4 px-6">
                                <div className="flex items-center gap-2">
                                  <div className={`w-2 h-2 rounded-full ${isHighRisk ? 'bg-red-500' : 'bg-amber-400'}`}></div>
                                  <span className={`text-xs font-bold ${isHighRisk ? 'text-red-700' : 'text-amber-700'}`}>{isHighRisk ? 'High' : 'Medium'}</span>
                                </div>
                              </td>
                              <td className="py-4 px-6">
                                <div className="font-bold text-slate-900 line-clamp-1">{task.task || task.task_name || 'Unnamed Task'}</div>
                                <div className="mt-1 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 uppercase">
                                  {task.status?.replace(/_/g, ' ') || 'Unknown Status'}
                                </div>
                              </td>
                              <td className="py-4 px-6">
                                <div className="font-semibold">{task.project || 'Unknown Project'}</div>
                                <div className="text-xs text-slate-500 mt-0.5">{task.module || 'General'}</div>
                              </td>
                              <td className="py-4 px-6">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-[10px] font-bold">
                                    {(task.assignee || 'U').charAt(0)}
                                  </div>
                                  <span>{task.assignee || 'Unassigned'}</span>
                                </div>
                              </td>
                              <td className="py-4 px-6">
                                {task.eta ? (
                                  <div className="text-sm">
                                    <div>{new Date(task.eta).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                                    {isHighRisk && <div className="text-[10px] text-red-600 font-bold mt-0.5">Overdue</div>}
                                  </div>
                                ) : (
                                  <span className="text-slate-400 text-xs italic">Not scheduled</span>
                                )}
                              </td>
                              <td className="py-4 px-6 text-right">
                                <button className="text-xs font-semibold text-violet-600 hover:text-violet-800 opacity-0 group-hover:opacity-100 transition-opacity">View Details</button>
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
        )}

        {activeTab === 'utilization' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            {utilLoading ? (
              <div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div>
            ) : !utilData || !utilData.heatmap ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-12 shadow-xs text-center">
                <Users size={48} className="text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-slate-800 mb-1">No utilization data</h3>
                <p className="text-slate-500 text-sm">Resource allocation data is not currently available.</p>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <h3 className="text-base font-bold text-slate-900">Team Workload & Capacity Utilization</h3>
                </div>
                
                <div className="space-y-5">
                  {Object.entries(utilData.heatmap).map(([emp, data]: [string, any]) => {
                    const allocated = data.allocated || 0;
                    const capacity = data.capacity || 40;
                    const percent = capacity > 0 ? Math.min(100, Math.round((allocated / capacity) * 100)) : 0;
                    const isOverallocated = percent > 95;
                    
                    return (
                      <div key={emp} className="space-y-1.5">
                        <div className="flex justify-between text-sm font-medium">
                          <span className="text-slate-800 flex items-center gap-2">
                            {emp}
                            {isOverallocated && <AlertTriangle size={12} className="text-red-500" />}
                          </span>
                          <span className={isOverallocated ? 'text-red-600 font-bold' : 'text-slate-600'}>
                            {percent}% <span className="text-slate-400 font-normal text-xs ml-1">({allocated}/{capacity} hrs)</span>
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all ${isOverallocated ? 'bg-red-500' : percent > 75 ? 'bg-amber-400' : 'bg-emerald-500'}`} 
                            style={{ width: `${percent}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'milestones' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            {milestoneLoading ? (
              <div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div>
            ) : !milestoneData || !milestoneData.milestones ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-12 shadow-xs text-center">
                <Diamond size={48} className="text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-slate-800 mb-1">No milestones tracked</h3>
                <p className="text-slate-500 text-sm">Create milestones in your project tracker to see them here.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {milestoneData.milestones.map((m: any, i: number) => (
                  <div key={i} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition-all">
                    <div>
                      <div className="flex justify-between items-start mb-3">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold bg-violet-100 text-violet-800 uppercase tracking-wider">
                          {m.project || 'Project'}
                        </span>
                        {m.status?.includes('Risk') || m.status?.includes('Delay') ? (
                          <span className="flex items-center gap-1 text-[11px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded">
                            <AlertTriangle size={12} /> At Risk
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">On Track</span>
                        )}
                      </div>
                      <h4 className="font-bold text-slate-900 text-lg mb-1">{m.name || m.task || 'Unnamed Milestone'}</h4>
                      <p className="text-xs text-slate-500 line-clamp-2">{m.description || m.remarks || 'No description provided.'}</p>
                    </div>
                    
                    <div className="mt-5 pt-4 border-t border-slate-100 flex justify-between items-end">
                      <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Target Date</p>
                        <p className="text-sm font-semibold text-slate-800">
                          {m.target_date || m.eta ? new Date(m.target_date || m.eta).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not scheduled'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Assignee</p>
                        <p className="text-sm font-semibold text-slate-800">{m.owner || m.assignee || 'Unassigned'}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'reminders' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            {reminderLoading ? (
              <div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div>
            ) : !reminderData || !reminderData.history ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-12 shadow-xs text-center">
                <Bell size={48} className="text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-slate-800 mb-1">No reminder activity</h3>
                <p className="text-slate-500 text-sm">Teams reminders have not been sent out yet.</p>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                  <h3 className="text-base font-bold text-slate-900">Teams Reminders & Execution History</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 font-medium text-xs uppercase tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-6">Timestamp</th>
                        <th className="py-3 px-6">Employee</th>
                        <th className="py-3 px-6">Task Count</th>
                        <th className="py-3 px-6">Status</th>
                        <th className="py-3 px-6">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {reminderData.history.map((record: any, i: number) => (
                        <tr key={i} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-6 text-slate-500 text-xs">
                            {new Date(record.sent_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="py-3 px-6 font-semibold text-slate-800">{record.employee}</td>
                          <td className="py-3 px-6">{record.task_count} pending</td>
                          <td className="py-3 px-6">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              record.status === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {record.status}
                            </span>
                          </td>
                          <td className="py-3 px-6 text-xs text-slate-500 max-w-xs truncate" title={record.message || record.error}>
                            {record.message || record.error || 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

