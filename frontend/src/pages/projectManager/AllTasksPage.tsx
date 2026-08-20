import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { projectManagerService } from '../../services/projectManagerService';
import { Search, AlertTriangle, Layers } from 'lucide-react';

export default function AllTasksPage() {
  const [projectFilter, setProjectFilter] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTask, setSelectedTask] = useState<any | null>(null);

  const { data: tasksRes, isLoading, error, refetch } = useQuery({
    queryKey: ['pmAllTasks', projectFilter, assigneeFilter, statusFilter],
    queryFn: () =>
      projectManagerService
        .getTasks({
          project: projectFilter || undefined,
          assignee: assigneeFilter || undefined,
          status: statusFilter || undefined,
        })
        .then((res) => res.data),
  });

  const tasks = tasksRes?.tasks || [];

  const filteredTasks = tasks.filter((t: any) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (t.task && t.task.toLowerCase().includes(q)) ||
      (t.assignee && t.assignee.toLowerCase().includes(q)) ||
      (t.project && t.project.toLowerCase().includes(q)) ||
      (t.module && t.module.toLowerCase().includes(q))
    );
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">All Tasks</h1>
          <p className="text-sm text-slate-500">Comprehensive list of all tasks across backend project sheets</p>
        </div>
        <div className="text-sm font-semibold text-slate-600 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm">
          Total Tasks: <span className="text-violet-600 font-bold">{filteredTasks.length}</span>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search task, assignee, project..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>

        <input
          type="text"
          placeholder="Filter by Project"
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 w-44"
        />

        <input
          type="text"
          placeholder="Filter by Assignee"
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value)}
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 w-44"
        />

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 w-44"
        >
          <option value="">All Statuses</option>
          <option value="in progress">In Progress</option>
          <option value="yet to start">Yet to Start</option>
          <option value="completed">Completed</option>
          <option value="delayed">Delayed / Blocked</option>
        </select>
      </div>

      {/* Tasks Table */}
      {isLoading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-4 animate-pulse">
          <div className="h-6 bg-slate-200 rounded w-1/3 mx-auto"></div>
          <div className="h-4 bg-slate-200 rounded w-1/2 mx-auto"></div>
          <div className="h-4 bg-slate-200 rounded w-2/3 mx-auto"></div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <AlertTriangle size={32} className="text-red-500 mx-auto mb-2" />
          <p className="text-red-700 font-semibold mb-2">Unable to load project tasks.</p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium"
          >
            Retry
          </button>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <Layers size={40} className="text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No tasks found</h3>
          <p className="text-sm text-slate-500">Try adjusting your filters or search query.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 font-semibold text-xs uppercase border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">Task / Module</th>
                  <th className="py-3.5 px-4">Project</th>
                  <th className="py-3.5 px-4">Assignee</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">ETA</th>
                  <th className="py-3.5 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredTasks.map((t: any, idx: number) => {
                  const isCompleted = t.status?.toLowerCase().includes('complete') || t.status?.toLowerCase().includes('done');
                  return (
                    <tr key={t.row_id || idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">{t.task}</div>
                        {t.module && t.module !== '-' && (
                          <span className="text-xs text-slate-400 block font-normal">Module: {t.module}</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 font-medium">
                        <span className="px-2 py-1 bg-slate-100 border border-slate-200 rounded-md text-xs">
                          {t.project}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-800">{t.assignee}</td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            isCompleted
                              ? 'bg-emerald-100 text-emerald-800'
                              : t.status?.toLowerCase().includes('progress')
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {t.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 font-mono text-xs">{t.eta_str || '-'}</td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => setSelectedTask(t)}
                          className="text-xs text-violet-600 hover:text-violet-800 font-semibold px-2 py-1 hover:bg-violet-50 rounded transition-colors"
                        >
                          View Drawer
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Task Drawer */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white h-full shadow-2xl p-6 flex flex-col justify-between overflow-y-auto">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-violet-600">{selectedTask.project}</span>
                <button
                  onClick={() => setSelectedTask(null)}
                  className="text-slate-400 hover:text-slate-600 text-sm font-bold px-2 py-1 rounded-md"
                >
                  ✕ Close
                </button>
              </div>

              <h2 className="text-xl font-bold text-slate-900 mb-2">{selectedTask.task}</h2>
              <p className="text-sm text-slate-600 mb-6">{selectedTask.description !== '-' ? selectedTask.description : 'No description provided.'}</p>

              <div className="space-y-4 text-sm">
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Assignee</span>
                  <span className="font-semibold text-slate-800">{selectedTask.assignee}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Status</span>
                  <span className="font-semibold text-slate-800">{selectedTask.status}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Start Date</span>
                  <span className="font-mono text-slate-700">{selectedTask.start_date_str || '-'}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">ETA / Due Date</span>
                  <span className="font-mono text-slate-700">{selectedTask.eta_str || '-'}</span>
                </div>
                <div className="py-2">
                  <span className="text-slate-500 font-medium block mb-1">Remarks</span>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 font-mono">
                    {selectedTask.remarks !== '-' ? selectedTask.remarks : 'No remarks logged yet.'}
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <button
                onClick={() => setSelectedTask(null)}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold transition-colors"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
