import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { projectApi, orgApi } from '../../services/api';
import type { Task, Milestone, ETAStatus } from '../../types';
import { Button, Avatar, Badge, Spinner, Modal } from '../../components/ui';
import { TASK_STATUS_CONFIG, PRIORITY_CONFIG, formatDate } from '../../utils';
import {
  ChevronLeft, ChevronRight, Plus,
  AlertTriangle, CheckCircle2, Clock, ShieldAlert, Diamond, Search, X
} from 'lucide-react';

interface ProjectCalendarViewProps {
  projectId: number;
  onSelectTask: (task: Task) => void;
  onAddTaskOnDate?: (dateStr: string) => void;
}

type CalendarViewMode = 'month' | 'week' | 'day';

const ETA_CONFIG: Record<ETAStatus, { label: string; bg: string; text: string; icon: any }> = {
  on_track: { label: 'On Track', bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', icon: CheckCircle2 },
  at_risk: { label: 'At Risk', bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', icon: AlertTriangle },
  delayed: { label: 'Delayed', bg: 'bg-rose-50 border-rose-200', text: 'text-rose-700', icon: Clock },
  blocked: { label: 'Blocked', bg: 'bg-purple-50 border-purple-200', text: 'text-purple-700', icon: ShieldAlert },
  completed: { label: 'Completed', bg: 'bg-slate-50 border-slate-200', text: 'text-slate-600', icon: CheckCircle2 },
};

export default function ProjectCalendarView({ projectId, onSelectTask, onAddTaskOnDate }: ProjectCalendarViewProps) {

  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  
  // Filters
  const [assigneeFilter, setAssigneeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [unscheduledOpen, setUnscheduledOpen] = useState(false);
  const [dayModalDate, setDayModalDate] = useState<string | null>(null);

  // Fetch project members/employees for filter
  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => { const r = await projectApi.get(projectId); return r.data; },
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees', project?.organization_id],
    queryFn: async () => { const r = await orgApi.employees(project.organization_id); return r.data; },
    enabled: !!project?.organization_id,
  });

  // Fetch calendar payload
  const { data: calendarData, isLoading } = useQuery({
    queryKey: ['calendar', projectId, assigneeFilter, statusFilter, priorityFilter],
    queryFn: async () => {
      const params: Record<string, any> = {};
      if (assigneeFilter) params.assignee_id = Number(assigneeFilter);
      if (statusFilter) params.status = statusFilter;
      if (priorityFilter) params.priority = priorityFilter;
      const r = await projectApi.getCalendar(projectId, params);
      return r.data;
    },
    enabled: !!projectId,
  });

  const scheduledTasks: Task[] = calendarData?.scheduled_tasks || [];
  const unscheduledTasks: Task[] = calendarData?.unscheduled_tasks || [];
  const milestones: Milestone[] = calendarData?.milestones || [];

  // Filter by search query
  const filteredTasks = useMemo(() => {
    if (!searchQuery.trim()) return scheduledTasks;
    const q = searchQuery.toLowerCase();
    return scheduledTasks.filter(t => t.title.toLowerCase().includes(q) || (t.assignee_name && t.assignee_name.toLowerCase().includes(q)));
  }, [scheduledTasks, searchQuery]);

  // Navigate dates
  const handlePrev = () => {
    const d = new Date(currentDate);
    if (viewMode === 'month') d.setMonth(d.getMonth() - 1);
    else if (viewMode === 'week') d.setDate(d.getDate() - 7);
    else d.setDate(d.getDate() - 1);
    setCurrentDate(d);
  };

  const handleNext = () => {
    const d = new Date(currentDate);
    if (viewMode === 'month') d.setMonth(d.getMonth() + 1);
    else if (viewMode === 'week') d.setDate(d.getDate() + 7);
    else d.setDate(d.getDate() + 1);
    setCurrentDate(d);
  };

  const handleToday = () => setCurrentDate(new Date());

  // Month View calculations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthMatrix = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    // Monday as start of week (0=Mon, 6=Sun)
    let startDay = firstDay.getDay() - 1;
    if (startDay < 0) startDay = 6;

    const days: { date: Date; isCurrentMonth: boolean; dateStr: string }[] = [];
    
    // Prev month padding
    for (let i = startDay - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      days.push({ date: d, isCurrentMonth: false, dateStr: d.toISOString().split('T')[0] });
    }

    // Current month days
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const d = new Date(year, month, i);
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({ date: d, isCurrentMonth: true, dateStr });
    }

    // Next month padding to fill grid
    const remaining = 35 - days.length > 0 ? 35 - days.length : (42 - days.length > 0 ? 42 - days.length : 0);
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      days.push({ date: d, isCurrentMonth: false, dateStr: d.toISOString().split('T')[0] });
    }

    return days;
  }, [year, month]);

  const todayStr = new Date().toISOString().split('T')[0];

  // Map tasks and milestones to date strings
  const itemsByDate = useMemo(() => {
    const map: Record<string, { tasks: Task[]; milestones: Milestone[] }> = {};

    filteredTasks.forEach(t => {
      const dateKey = t.due_date || t.start_date;
      if (dateKey) {
        if (!map[dateKey]) map[dateKey] = { tasks: [], milestones: [] };
        map[dateKey].tasks.push(t);
      }
    });

    milestones.forEach(m => {
      if (m.target_date) {
        if (!map[m.target_date]) map[m.target_date] = { tasks: [], milestones: [] };
        map[m.target_date].milestones.push(m);
      }
    });

    return map;
  }, [filteredTasks, milestones]);

  if (isLoading) {
    return <div className="flex justify-center py-20"><Spinner className="w-8 h-8 text-violet-600" /></div>;
  }

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Calendar Top Control Bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between gap-4">
        {/* Left: View Switcher + Date Navigation */}
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
            {(['month', 'week', 'day'] as CalendarViewMode[]).map(m => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                className={`px-3 py-1 text-xs font-semibold rounded-md capitalize transition-all ${
                  viewMode === m ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handlePrev}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
              title="Previous"
            >
              <ChevronLeft size={16} />
            </button>
            <Button variant="ghost" size="sm" onClick={handleToday} className="text-xs font-semibold">
              Today
            </Button>
            <button
              onClick={handleNext}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
              title="Next"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <h2 className="text-base font-bold text-slate-800">
            {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
          </h2>
        </div>

        {/* Right: Filters & Unscheduled Drawer Toggle */}
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative w-44">
            <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
          </div>

          {/* Assignee Filter */}
          <select
            value={assigneeFilter}
            onChange={e => setAssigneeFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-violet-500"
          >
            <option value="">All Assignees</option>
            {employees.map((emp: any) => (
              <option key={emp.id} value={emp.id}>{emp.full_name}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-violet-500"
          >
            <option value="">All Statuses</option>
            {Object.entries(TASK_STATUS_CONFIG).map(([v, cfg]) => (
              <option key={v} value={v}>{cfg.label}</option>
            ))}
          </select>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={e => setPriorityFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-violet-500"
          >
            <option value="">All Priorities</option>
            {Object.entries(PRIORITY_CONFIG).map(([v, cfg]) => (
              <option key={v} value={v}>{cfg.label}</option>
            ))}
          </select>

          {/* Unscheduled Tasks Button */}
          <Button
            variant={unscheduledTasks.length > 0 ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setUnscheduledOpen(!unscheduledOpen)}
            className="relative text-xs font-semibold"
          >
            Unscheduled ({unscheduledTasks.length})
          </Button>
        </div>
      </div>

      {/* Main Grid Content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Month View Grid */}
        {viewMode === 'month' && (
          <div className="flex-1 flex flex-col overflow-auto p-4">
            <div className="grid grid-cols-7 gap-px bg-slate-200 border border-slate-200 rounded-xl overflow-hidden shadow-sm flex-1 min-h-[600px]">
              {/* Header Days */}
              {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(day => (
                <div key={day} className="bg-slate-100 py-2 text-center text-xs font-bold text-slate-600 tracking-wider">
                  {day}
                </div>
              ))}

              {/* Days Grid Cells */}
              {monthMatrix.map((cell, idx) => {
                const dayItems = itemsByDate[cell.dateStr] || { tasks: [], milestones: [] };
                const isToday = cell.dateStr === todayStr;
                const visibleTasks = dayItems.tasks.slice(0, 2);
                const extraCount = dayItems.tasks.length - visibleTasks.length;

                return (
                  <div
                    key={idx}
                    onClick={(e) => {
                      // If empty date click, trigger task creation on date
                      if (e.target === e.currentTarget && onAddTaskOnDate) {
                        onAddTaskOnDate(cell.dateStr);
                      }
                    }}
                    className={`bg-white p-1.5 flex flex-col justify-between transition-colors hover:bg-slate-50 cursor-pointer min-h-[100px] ${
                      !cell.isCurrentMonth ? 'bg-slate-50/50 text-slate-400' : ''
                    } ${isToday ? 'ring-2 ring-violet-500 ring-inset bg-violet-50/20' : ''}`}
                  >
                    {/* Top Row: Date Number & Add Button */}
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                          isToday ? 'bg-violet-600 text-white' : cell.isCurrentMonth ? 'text-slate-700' : 'text-slate-400'
                        }`}
                      >
                        {cell.date.getDate()}
                      </span>
                      {onAddTaskOnDate && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onAddTaskOnDate(cell.dateStr);
                          }}
                          className="opacity-0 group-hover:opacity-100 hover:bg-slate-100 p-0.5 rounded text-slate-400 hover:text-violet-600 transition-all"
                          title="Create task on this date"
                        >
                          <Plus size={12} />
                        </button>
                      )}
                    </div>

                    {/* Milestones */}
                    <div className="space-y-1 mb-1">
                      {dayItems.milestones.map(m => (
                        <div
                          key={m.id}
                          className="bg-amber-500 text-white px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 truncate shadow-sm"
                          title={`Milestone: ${m.name}`}
                        >
                          <Diamond size={10} className="fill-current flex-shrink-0" />
                          <span className="truncate">{m.name}</span>
                        </div>
                      ))}

                      {/* Tasks Cards */}
                      {visibleTasks.map(task => {
                        const etaCfg = ETA_CONFIG[task.eta_status || 'on_track'];
                        const EtaIcon = etaCfg.icon;

                        return (
                          <div
                            key={task.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectTask(task);
                            }}
                            className={`group/card p-1.5 bg-white border border-slate-200 rounded-lg shadow-sm hover:shadow-md hover:border-violet-300 transition-all text-left flex flex-col gap-1 ${
                              task.status === 'completed' ? 'opacity-70 bg-slate-50' : ''
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className={`text-xs font-semibold text-slate-800 line-clamp-1 group-hover/card:text-violet-700 ${task.status === 'completed' ? 'line-through text-slate-500' : ''}`}>
                                {task.title}
                              </span>
                              {task.priority && (
                                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${PRIORITY_CONFIG[task.priority].dot}`} />
                              )}
                            </div>

                            <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                              {/* ETA Badge */}
                              {task.eta_status && task.eta_status !== 'on_track' && task.eta_status !== 'completed' && (
                                <span className={`px-1 py-0.5 rounded text-[9px] font-bold flex items-center gap-0.5 border ${etaCfg.bg} ${etaCfg.text}`}>
                                  <EtaIcon size={9} />
                                  <span>{etaCfg.label}</span>
                                </span>
                              )}
                              
                              {task.assignee_name ? (
                                <Avatar name={task.assignee_name} size="xs" />
                              ) : (
                                <span className="text-[9px] text-slate-400">Unassigned</span>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {extraCount > 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDayModalDate(cell.dateStr);
                          }}
                          className="w-full text-left text-[11px] font-semibold text-violet-600 hover:text-violet-800 hover:bg-violet-50 px-1 py-0.5 rounded transition-colors"
                        >
                          +{extraCount} more...
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Week View */}
        {viewMode === 'week' && (
          <div className="flex-1 p-6 overflow-auto">
            <div className="grid grid-cols-7 gap-4">
              {Array.from({ length: 7 }).map((_, i) => {
                const d = new Date(currentDate);
                const dayOfWeek = d.getDay() || 7;
                d.setDate(d.getDate() - dayOfWeek + 1 + i);
                const dateStr = d.toISOString().split('T')[0];
                const dayItems = itemsByDate[dateStr] || { tasks: [], milestones: [] };
                const isToday = dateStr === todayStr;

                return (
                  <div key={dateStr} className={`bg-white border rounded-xl p-3 flex flex-col gap-3 min-h-[500px] shadow-sm ${isToday ? 'border-violet-500 ring-1 ring-violet-500' : 'border-slate-200'}`}>
                    <div className="border-b pb-2 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-slate-400 block">{d.toLocaleDateString('default', { weekday: 'short' })}</span>
                        <span className={`text-base font-extrabold ${isToday ? 'text-violet-600' : 'text-slate-800'}`}>{d.getDate()}</span>
                      </div>
                      {onAddTaskOnDate && (
                        <Button variant="ghost" size="sm" onClick={() => onAddTaskOnDate(dateStr)}>
                          <Plus size={14} />
                        </Button>
                      )}
                    </div>

                    <div className="space-y-2 flex-1">
                      {dayItems.milestones.map(m => (
                        <div key={m.id} className="bg-amber-500 text-white p-2 rounded-lg text-xs font-bold flex items-center gap-1.5">
                          <Diamond size={12} />
                          <span>{m.name}</span>
                        </div>
                      ))}

                      {dayItems.tasks.map(task => (
                        <div
                          key={task.id}
                          onClick={() => onSelectTask(task)}
                          className="bg-slate-50 hover:bg-violet-50/50 border border-slate-200 hover:border-violet-300 p-2.5 rounded-lg cursor-pointer transition-all space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-800 line-clamp-2">{task.title}</span>
                            <span className={`w-2 h-2 rounded-full ${PRIORITY_CONFIG[task.priority].dot}`} />
                          </div>
                          <div className="flex items-center justify-between pt-1">
                            <Badge className={TASK_STATUS_CONFIG[task.status].color}>
                              {TASK_STATUS_CONFIG[task.status].label}
                            </Badge>
                            {task.assignee_name && <Avatar name={task.assignee_name} size="xs" />}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Day View */}
        {viewMode === 'day' && (
          <div className="flex-1 p-6 overflow-auto max-w-3xl mx-auto">
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b pb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    {currentDate.toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </h3>
                  <span className="text-xs text-slate-500">Scheduled Work & Milestones</span>
                </div>
                {onAddTaskOnDate && (
                  <Button variant="primary" size="sm" onClick={() => onAddTaskOnDate(currentDate.toISOString().split('T')[0])}>
                    <Plus size={14} /> Add Task
                  </Button>
                )}
              </div>

              {(() => {
                const dateStr = currentDate.toISOString().split('T')[0];
                const dayItems = itemsByDate[dateStr] || { tasks: [], milestones: [] };
                if (dayItems.tasks.length === 0 && dayItems.milestones.length === 0) {
                  return <p className="text-sm text-slate-400 text-center py-10">No scheduled tasks or milestones on this date.</p>;
                }
                return (
                  <div className="space-y-3">
                    {dayItems.milestones.map(m => (
                      <div key={m.id} className="bg-amber-50 border border-amber-200 text-amber-900 p-3 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Diamond size={16} className="text-amber-600 fill-current" />
                          <span className="font-bold text-sm">{m.name}</span>
                        </div>
                        <span className="text-xs font-medium text-amber-700">Milestone Checkpoint</span>
                      </div>
                    ))}
                    {dayItems.tasks.map(task => (
                      <div
                        key={task.id}
                        onClick={() => onSelectTask(task)}
                        className="bg-white border border-slate-200 hover:border-violet-400 p-4 rounded-xl shadow-sm hover:shadow-md cursor-pointer transition-all flex items-center justify-between"
                      >
                        <div className="space-y-1">
                          <h4 className="text-sm font-bold text-slate-800">{task.title}</h4>
                          {task.description && <p className="text-xs text-slate-500 line-clamp-1">{task.description}</p>}
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge className={TASK_STATUS_CONFIG[task.status].color}>{TASK_STATUS_CONFIG[task.status].label}</Badge>
                          {task.assignee_name && <Avatar name={task.assignee_name} size="sm" />}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* Unscheduled Tasks Drawer Sidebar */}
        {unscheduledOpen && (
          <div className="w-80 bg-white border-l border-slate-200 flex flex-col shadow-xl z-20">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Unscheduled Tasks</h3>
                <p className="text-xs text-slate-500">Tasks without start or due date</p>
              </div>
              <button onClick={() => setUnscheduledOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-3">
              {unscheduledTasks.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-8">All tasks are scheduled!</p>
              ) : (
                unscheduledTasks.map(task => (
                  <div
                    key={task.id}
                    onClick={() => onSelectTask(task)}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-lg hover:border-violet-400 hover:bg-violet-50/40 cursor-pointer transition-all space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-800">{task.title}</span>
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${PRIORITY_CONFIG[task.priority].dot}`} />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>{task.assignee_name || 'Unassigned'}</span>
                      <span className="text-violet-600 font-semibold hover:underline">Set Dates →</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Day Details Modal (when +N more is clicked) */}
      {dayModalDate && (
        <Modal open={!!dayModalDate} onClose={() => setDayModalDate(null)} title={`Tasks on ${formatDate(dayModalDate)}`}>
          <div className="p-6 space-y-3 max-h-[400px] overflow-auto">
            {(itemsByDate[dayModalDate]?.tasks || []).map(task => (
              <div
                key={task.id}
                onClick={() => {
                  setDayModalDate(null);
                  onSelectTask(task);
                }}
                className="p-3 border border-slate-200 rounded-xl hover:border-violet-400 cursor-pointer transition-all flex items-center justify-between"
              >
                <div>
                  <h4 className="text-sm font-semibold text-slate-800">{task.title}</h4>
                  <p className="text-xs text-slate-500">{task.assignee_name || 'Unassigned'}</p>
                </div>
                <Badge className={TASK_STATUS_CONFIG[task.status].color}>{TASK_STATUS_CONFIG[task.status].label}</Badge>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
