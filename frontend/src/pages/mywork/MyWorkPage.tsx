import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/authStore';
import { myWorkService, type UnifiedTask } from '../../services/myWorkService';
import { SourceBadge } from '../../components/ui/SourceBadge';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
  Search,
  Layers,
  User,
  Calendar,
} from 'lucide-react';

export default function MyWorkPage() {
  const { user, orgId } = useAuthStore();
  const [sourceFilter, setSourceFilter] = useState<'all' | 'workmate' | 'sharepoint_task'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTask, setSelectedTask] = useState<UnifiedTask | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');

  const {
    data,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ['unifiedMyTasks', orgId, user?.email, user?.full_name],
    queryFn: () => myWorkService.getUnifiedMyTasks(orgId ?? undefined, user?.email, user?.full_name),
  });

  const tasks = data?.tasks || [];
  const lastSyncedAt = data?.lastSyncedAt || '';
  const errors = data?.errors || {};

  // Filter tasks
  const filteredTasks = tasks.filter((t) => {
    if (sourceFilter !== 'all' && t.source !== sourceFilter) return false;
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const titleMatch = t.title.toLowerCase().includes(q);
      const projMatch = t.project.toLowerCase().includes(q);
      const assigneeMatch = t.assignee.toLowerCase().includes(q);
      if (!titleMatch && !projMatch && !assigneeMatch) return false;
    }

    return true;
  });

  const todayStr = new Date().toDateString();

  const totalCount = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === 'completed');
  const activeTasks = tasks.filter((t) => t.status !== 'completed' && t.status !== 'cancelled');

  const overdueTasks = activeTasks.filter((t) => {
    if (!t.dueDate) return false;
    const due = new Date(t.dueDate);
    return due < new Date() && due.toDateString() !== todayStr;
  });

  const dueTodayTasks = activeTasks.filter((t) => {
    if (!t.dueDate) return false;
    const due = new Date(t.dueDate);
    return due.toDateString() === todayStr;
  });

  const upcomingTasks = activeTasks.filter((t) => {
    if (!t.dueDate) return true;
    const due = new Date(t.dueDate);
    return due > new Date() && due.toDateString() !== todayStr;
  });

  const groupedTasks = {
    today: filteredTasks.filter((t) => {
      if (t.status === 'completed') return false;
      if (!t.dueDate) return false;
      return new Date(t.dueDate).toDateString() === todayStr;
    }),
    overdue: filteredTasks.filter((t) => {
      if (t.status === 'completed') return false;
      if (!t.dueDate) return false;
      const due = new Date(t.dueDate);
      return due < new Date() && due.toDateString() !== todayStr;
    }),
    upcoming: filteredTasks.filter((t) => {
      if (t.status === 'completed') return false;
      if (!t.dueDate) return true;
      const due = new Date(t.dueDate);
      return due > new Date() && due.toDateString() !== todayStr;
    }),
    completed: filteredTasks.filter((t) => t.status === 'completed'),
  };

  return (
    <div className="h-full flex flex-col max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">MY WORK</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Good morning, <span className="font-semibold text-slate-800">{user?.full_name || 'User'}</span>. Your work across WORKMATE and connected workspaces.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {lastSyncedAt && (
            <span className="text-xs text-slate-400 font-mono">Synced {lastSyncedAt}</span>
          )}
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="px-3.5 py-2 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 font-medium text-xs rounded-lg shadow-sm flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw size={14} className={isRefetching ? 'animate-spin text-violet-600' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {(errors.workmate || errors.sharepoint) && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-amber-600" />
            <span>
              {errors.workmate && `WORKMATE tasks warning: ${errors.workmate}. `}
              {errors.sharepoint && `SharePoint sync notice: ${errors.sharepoint}.`}
            </span>
          </div>
          <button onClick={() => refetch()} className="font-bold underline text-amber-900 hover:text-amber-700">
            Retry
          </button>
        </div>
      )}

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider flex items-center gap-1.5 mb-1">
            <Clock size={14} /> Today
          </span>
          <div className="text-2xl font-bold text-slate-900">{dueTodayTasks.length}</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Tasks due today</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider flex items-center gap-1.5 mb-1">
            <Layers size={14} /> Upcoming
          </span>
          <div className="text-2xl font-bold text-slate-900">{upcomingTasks.length}</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Scheduled upcoming</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-xs font-semibold text-red-600 uppercase tracking-wider flex items-center gap-1.5 mb-1">
            <AlertCircle size={14} /> Overdue
          </span>
          <div className="text-2xl font-bold text-red-700">{overdueTasks.length}</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Requires attention</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider flex items-center gap-1.5 mb-1">
            <CheckCircle2 size={14} /> Completed
          </span>
          <div className="text-2xl font-bold text-emerald-700">{completedTasks.length}</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Finished tasks</p>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
        {/* Source Pills */}
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-2">Source:</span>
          <button
            onClick={() => setSourceFilter('all')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
              sourceFilter === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Sources ({totalCount})
          </button>

          <button
            onClick={() => setSourceFilter('workmate')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              sourceFilter === 'workmate'
                ? 'bg-violet-600 text-white shadow-xs'
                : 'bg-violet-50 text-violet-700 hover:bg-violet-100 border border-violet-100'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400"></span>
            <span>WORKMATE ({tasks.filter((t) => t.source === 'workmate').length})</span>
          </button>

          <button
            onClick={() => setSourceFilter('sharepoint_task')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              sourceFilter === 'sharepoint_task'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'bg-teal-50 text-teal-800 hover:bg-teal-100 border border-teal-100'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400"></span>
            <span>SharePoint ({tasks.filter((t) => t.source === 'sharepoint_task').length})</span>
          </button>
        </div>

        {/* Filters and View Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            <div className="relative flex-1 min-w-[220px]">
              <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search title, project, assignee..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="all">All Statuses</option>
              <option value="todo">To Do / Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="all">All Priorities</option>
              <option value="urgent">Urgent / Overdue</option>
              <option value="high">High Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="low">Low Priority</option>
            </select>
          </div>

          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                viewMode === 'list' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>List View</span>
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                viewMode === 'kanban' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>Kanban Board</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center animate-pulse space-y-4">
          <div className="h-6 bg-slate-200 rounded w-1/4 mx-auto"></div>
          <div className="h-4 bg-slate-200 rounded w-1/3 mx-auto"></div>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <CheckCircle2 size={40} className="text-emerald-500 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">You are all caught up!</h3>
          <p className="text-sm text-slate-500 mt-1">
            {sourceFilter !== 'all'
              ? `No ${sourceFilter === 'sharepoint_task' ? 'SharePoint' : 'WORKMATE'} tasks found.`
              : 'No tasks need your attention right now.'}
          </p>
        </div>
      ) : viewMode === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 overflow-x-auto pb-4">
          <KanbanColumn
            title="To Do / Pending"
            tasks={filteredTasks.filter((t) => t.status === 'todo')}
            onSelect={setSelectedTask}
            color="slate"
          />
          <KanbanColumn
            title="In Progress"
            tasks={filteredTasks.filter((t) => t.status === 'in_progress')}
            onSelect={setSelectedTask}
            color="blue"
          />
          <KanbanColumn
            title="Overdue / Urgent"
            tasks={filteredTasks.filter((t) => t.priority === 'urgent' && t.status !== 'completed')}
            onSelect={setSelectedTask}
            color="red"
          />
          <KanbanColumn
            title="Completed"
            tasks={filteredTasks.filter((t) => t.status === 'completed')}
            onSelect={setSelectedTask}
            color="emerald"
          />
        </div>
      ) : (
        <div className="space-y-6">
          {groupedTasks.today.length > 0 && (
            <TaskGroupSection title="TODAY" count={groupedTasks.today.length} color="amber">
              {groupedTasks.today.map((task) => (
                <TaskRowCard key={task.id} task={task} onSelect={() => setSelectedTask(task)} />
              ))}
            </TaskGroupSection>
          )}

          {groupedTasks.overdue.length > 0 && (
            <TaskGroupSection title="OVERDUE" count={groupedTasks.overdue.length} color="red">
              {groupedTasks.overdue.map((task) => (
                <TaskRowCard key={task.id} task={task} onSelect={() => setSelectedTask(task)} />
              ))}
            </TaskGroupSection>
          )}

          {groupedTasks.upcoming.length > 0 && (
            <TaskGroupSection title="UPCOMING" count={groupedTasks.upcoming.length} color="slate">
              {groupedTasks.upcoming.map((task) => (
                <TaskRowCard key={task.id} task={task} onSelect={() => setSelectedTask(task)} />
              ))}
            </TaskGroupSection>
          )}

          {groupedTasks.completed.length > 0 && (
            <TaskGroupSection title="COMPLETED" count={groupedTasks.completed.length} color="emerald">
              {groupedTasks.completed.map((task) => (
                <TaskRowCard key={task.id} task={task} onSelect={() => setSelectedTask(task)} />
              ))}
            </TaskGroupSection>
          )}
        </div>
      )}

      {/* Task Drawer */}
      {selectedTask && (
        <UnifiedTaskDrawer task={selectedTask} onClose={() => setSelectedTask(null)} />
      )}
    </div>
  );
}

function KanbanColumn({
  title,
  tasks,
  onSelect,
  color,
}: {
  title: string;
  tasks: UnifiedTask[];
  onSelect: (t: UnifiedTask) => void;
  color: 'slate' | 'blue' | 'red' | 'emerald';
}) {
  const colorMap = {
    slate: 'bg-slate-100 border-slate-200 text-slate-700',
    blue: 'bg-blue-50 border-blue-200 text-blue-800',
    red: 'bg-red-50 border-red-200 text-red-800',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  };

  return (
    <div className="flex flex-col bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-3 min-w-[260px]">
      <div className="flex items-center justify-between px-1">
        <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${colorMap[color]}`}>
          {title}
        </span>
        <span className="text-xs font-bold text-slate-400 bg-white px-2 py-0.5 rounded-full border border-slate-200">
          {tasks.length}
        </span>
      </div>

      <div className="space-y-2 flex-1 overflow-y-auto max-h-[600px]">
        {tasks.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg">
            No tasks
          </div>
        ) : (
          tasks.map((task) => (
            <div
              key={task.id}
              onClick={() => onSelect(task)}
              className="bg-white border border-slate-200 rounded-lg p-3 hover:shadow-md transition-all cursor-pointer space-y-2 group"
            >
              <div className="flex items-start justify-between gap-2">
                <h5 className="text-xs font-bold text-slate-900 group-hover:text-violet-700 line-clamp-2">
                  {task.title}
                </h5>
                <SourceBadge source={task.source} />
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                <span className="font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded truncate max-w-[120px]">
                  {task.project}
                </span>
                {task.dueDate && (
                  <span className="font-mono text-slate-400 text-[10px]">{task.dueDate}</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function TaskGroupSection({
  title,
  count,
  color,
  children,
}: {
  title: string;
  count: number;
  color: 'amber' | 'red' | 'slate' | 'emerald';
  children: React.ReactNode;
}) {
  const colorMap = {
    amber: 'text-amber-800 bg-amber-50 border-amber-200',
    red: 'text-red-800 bg-red-50 border-red-200',
    slate: 'text-slate-800 bg-slate-100 border-slate-200',
    emerald: 'text-emerald-800 bg-emerald-50 border-emerald-200',
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className={`px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider border ${colorMap[color]}`}>
          {title} ({count})
        </span>
      </div>
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs divide-y divide-slate-100">
        {children}
      </div>
    </div>
  );
}

function TaskRowCard({ task, onSelect }: { task: UnifiedTask; onSelect: () => void }) {
  const isCompleted = task.status === 'completed';

  return (
    <div
      onClick={onSelect}
      className="p-4 hover:bg-slate-50/80 transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
    >
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <div className="mt-0.5">
          <div
            className={`w-4 h-4 rounded-full border flex items-center justify-center ${
              isCompleted ? 'bg-emerald-500 border-emerald-600 text-white' : 'border-slate-300 group-hover:border-violet-500'
            }`}
          >
            {isCompleted && <CheckCircle2 size={12} />}
          </div>
        </div>

        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4
              className={`text-sm font-semibold truncate ${
                isCompleted ? 'line-through text-slate-400' : 'text-slate-900 group-hover:text-violet-700'
              }`}
            >
              {task.title}
            </h4>
            <SourceBadge source={task.source} />
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
            <span className="font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
              {task.project}
            </span>
            {task.module && <span className="text-slate-400">Module: {task.module}</span>}
            {task.assignee && (
              <span className="flex items-center gap-1 text-slate-600">
                <User size={12} className="text-slate-400" />
                {task.assignee}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs font-medium self-end sm:self-auto shrink-0">
        <span
          className={`px-2 py-0.5 rounded text-[11px] font-bold ${
            task.priority === 'urgent'
              ? 'bg-red-100 text-red-800'
              : task.priority === 'high'
              ? 'bg-amber-100 text-amber-800'
              : 'bg-slate-100 text-slate-700'
          }`}
        >
          {task.priority.toUpperCase()}
        </span>

        {task.dueDate && (
          <span className="font-mono text-slate-600 flex items-center gap-1">
            <Calendar size={12} className="text-slate-400" />
            {task.dueDate}
          </span>
        )}

        <button className="text-violet-600 font-semibold hover:underline text-[11px]">Details</button>
      </div>
    </div>
  );
}

function UnifiedTaskDrawer({ task, onClose }: { task: UnifiedTask; onClose: () => void }) {
  const isSharePoint = task.source === 'sharepoint_task';
  const meta = task.sourceMetadata || {};

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-white h-full shadow-2xl p-6 flex flex-col justify-between overflow-y-auto">
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <SourceBadge source={task.source} />
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{task.project}</span>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 text-sm font-bold px-2 py-1 rounded-md"
            >
              ✕ Close
            </button>
          </div>

          <div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">{task.title}</h2>
            {task.description && <p className="text-sm text-slate-600 leading-relaxed">{task.description}</p>}
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500 font-medium">Source</span>
              <span className="font-semibold text-slate-800">{isSharePoint ? 'SharePoint Task' : 'WORKMATE Native'}</span>
            </div>

            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500 font-medium">Type Tag</span>
              <span className="font-mono text-xs font-bold text-violet-700 bg-violet-50 px-2 py-0.5 rounded border border-violet-200">
                {task.source}
              </span>
            </div>

            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500 font-medium">Assignee</span>
              <span className="font-semibold text-slate-800">{task.assignee}</span>
            </div>

            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500 font-medium">Status</span>
              <span className="font-semibold text-slate-800">{task.status}</span>
            </div>

            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500 font-medium">Due Date / ETA</span>
              <span className="font-mono text-slate-700">{task.dueDate || task.eta || '-'}</span>
            </div>

            {isSharePoint && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-xs">
                <span className="font-bold text-slate-700 block uppercase tracking-wider">SharePoint Workbook Metadata</span>
                {meta.workbook && <div>Workbook / Sheet: <span className="font-mono">{meta.workbook}</span></div>}
                {meta.row !== undefined && <div>Row ID: <span className="font-mono">{meta.row}</span></div>}
                {task.remarks && <div>Remarks: <span className="font-mono text-slate-600">{task.remarks}</span></div>}
              </div>
            )}
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold transition-colors"
          >
            Close Drawer
          </button>
        </div>
      </div>
    </div>
  );
}
