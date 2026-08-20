import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { projectManagerService } from '../../services/projectManagerService';
import { SourceBadge } from '../../components/ui/SourceBadge';
import { Spinner } from '../../components/ui';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { projectApi } from '../../services/api';



export default function GlobalCalendarPage() {
  const { orgId } = useAuthStore();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [sourceFilter, setSourceFilter] = useState<'all' | 'workmate' | 'sharepoint_task'>('all');
  const [selectedTask, setSelectedTask] = useState<any | null>(null);

  // Fetch SharePoint / PM Tasks
  const { data: pmData, isLoading: isPmLoading } = useQuery({
    queryKey: ['globalCalendarPmTasks'],
    queryFn: async () => {
      try {
        const res = await projectManagerService.getTasks();
        return res.data;
      } catch {
        return { tasks: [] };
      }
    },
  });

  // Fetch all WORKMATE Projects and aggregate their project calendar tasks
  const { data: wmProjectsTasks, isLoading: isWmLoading } = useQuery({
    queryKey: ['globalCalendarWmProjectsTasks', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      try {
        const projRes = await projectApi.list(orgId);
        const projects = Array.isArray(projRes.data) ? projRes.data : [];
        
        let allTasks: any[] = [];
        for (const proj of projects) {
          try {
            const calRes = await projectApi.getCalendar(proj.id);
            const scheduled = calRes.data?.scheduled_tasks || [];
            const milestones = calRes.data?.milestones || [];
            
            const normalizedTasks = scheduled.map((t: any) => ({
              ...t,
              project_name: proj.name,
            }));

            const normalizedMilestones = milestones.map((m: any) => ({
              id: `m-${m.id}`,
              title: `Milestone: ${m.name}`,
              description: m.description || '',
              project_name: proj.name,
              assignee_name: m.owner_name || 'Project Owner',
              status: m.status || 'upcoming',
              due_date: m.target_date,
              is_milestone: true,
            }));

            allTasks = [...allTasks, ...normalizedTasks, ...normalizedMilestones];
          } catch {
            // fallback if calendar fetch fails for single project
          }
        }
        return allTasks;
      } catch {
        return [];
      }
    },
    enabled: !!orgId,
  });

  const isLoading = isPmLoading || isWmLoading;

  // Normalize PM Tasks
  const spTasks = (pmData?.tasks || []).map((t: any) => ({
    id: `sp-${t.row_id || t.task}`,
    task: t.task,
    description: t.description !== '-' ? t.description : '',
    project: t.project || 'SharePoint Project',
    assignee: t.assignee || 'Unassigned',
    status: t.status || 'in_progress',
    dateStr: t.start_date_str !== '-' ? t.start_date_str : t.eta_str,
    source: 'sharepoint_task',
    raw: t,
  }));

  // Normalize WORKMATE Tasks & Milestones
  const wmTasks = (wmProjectsTasks || []).map((t: any) => ({
    id: t.id ? String(t.id) : `wm-${Math.random()}`,
    task: t.title,
    description: t.description || '',
    project: t.project_name || 'WORKMATE Project',
    assignee: t.assignee_name || (t.assignee?.user?.full_name ?? 'Unassigned'),
    status: t.status || 'not_started',
    dateStr: t.due_date || t.start_date || (t.created_at ? t.created_at.split('T')[0] : ''),
    source: 'workmate',
    raw: t,
  }));

  const allTasks = [...spTasks, ...wmTasks];




  const filteredTasks = allTasks.filter((t: any) => {
    if (sourceFilter === 'all') return true;
    return t.source === sourceFilter;
  });


  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const todayMonth = () => setCurrentDate(new Date());

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const emptyPrefix = Array.from({ length: firstDayOfWeek }, (_, i) => i);

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-8 py-5 flex-shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-violet-50 text-violet-700 rounded-lg">
                <CalendarIcon size={20} />
              </span>
              <div>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">Unified Calendar</h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Deadlines, ETAs, and milestones aggregated across WORKMATE and SharePoint task trackers.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Filter Toggle */}
            <div className="flex items-center bg-slate-100 p-1 rounded-lg">
              <button
                onClick={() => setSourceFilter('all')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  sourceFilter === 'all' ? 'bg-white text-violet-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                All Sources
              </button>
              <button
                onClick={() => setSourceFilter('workmate')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  sourceFilter === 'workmate' ? 'bg-white text-violet-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                WORKMATE Tasks
              </button>
              <button
                onClick={() => setSourceFilter('sharepoint_task')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  sourceFilter === 'sharepoint_task' ? 'bg-white text-violet-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                SharePoint Tasks
              </button>

            </div>

            <button
              onClick={todayMonth}
              className="px-3 py-1.5 bg-white border border-slate-200 text-xs font-semibold rounded-lg hover:bg-slate-50 text-slate-700 transition-colors"
            >
              Today
            </button>
            
            <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs">
              <button onClick={prevMonth} className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded">
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs font-bold px-3 text-slate-800 min-w-[120px] text-center">
                {monthNames[month]} {year}
              </span>
              <button onClick={nextMonth} className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid area — flexible fill */}
      <div className="flex-1 overflow-auto p-8">
        {isLoading ? (
          <div className="flex items-center justify-center h-64"><Spinner className="w-8 h-8" /></div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs flex flex-col h-full min-h-[600px]">
            {/* Day of Week Headers */}
            <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/80 text-center text-xs font-bold text-slate-500 py-3">
              <div>SUN</div>
              <div>MON</div>
              <div>TUE</div>
              <div>WED</div>
              <div>THU</div>
              <div>FRI</div>
              <div>SAT</div>
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 flex-1">
              {emptyPrefix.map((_, i) => (
                <div key={`empty-${i}`} className="bg-slate-50/30 p-2" />
              ))}

              {daysArray.map((day) => {
                const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                
                const dayTasks = filteredTasks.filter((t: any) => {
                  if (!t.dateStr) return false;
                  return t.dateStr.includes(dayStr);
                });


                const isToday = new Date().toDateString() === new Date(year, month, day).toDateString();

                return (
                  <div key={day} className={`p-2.5 flex flex-col space-y-1.5 ${isToday ? 'bg-violet-50/20' : ''}`}>
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-bold ${
                          isToday
                            ? 'w-6 h-6 rounded-full bg-violet-600 text-white flex items-center justify-center shadow-xs'
                            : 'text-slate-700'
                        }`}
                      >
                        {day}
                      </span>
                      {dayTasks.length > 0 && (
                        <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
                          {dayTasks.length} tasks
                        </span>
                      )}
                    </div>

                    <div className="flex-1 space-y-1.5 overflow-y-auto max-h-[110px] pr-1">
                      {dayTasks.map((t: any, idx: number) => (
                        <div
                          key={idx}
                          onClick={() => setSelectedTask(t)}
                          className="bg-white border border-slate-200 hover:border-violet-300 hover:shadow-xs p-1.5 rounded-lg transition-all cursor-pointer text-[11px] group"
                        >
                          <div className="font-semibold text-slate-800 group-hover:text-violet-700 transition-colors truncate">
                            {t.task}
                          </div>
                          <div className="flex items-center justify-between mt-1 pt-1 border-t border-slate-50">
                            <SourceBadge source={t.source} className="text-[9px] px-1 py-0" showIcon={false} />
                            <span className="text-[10px] text-slate-400 truncate max-w-[70px]">{t.assignee}</span>
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
      </div>

      {/* Task Drawer overlay */}
      {selectedTask && (
        <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-xs flex justify-end z-50">
          <div className="w-full max-w-md bg-white h-full shadow-2xl p-6 flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-200">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                <SourceBadge source="sharepoint_task" />
                <button onClick={() => setSelectedTask(null)} className="text-slate-400 hover:text-slate-600 text-sm font-semibold">✕ Close</button>
              </div>

              <h2 className="text-lg font-bold text-slate-900 mb-2">{selectedTask.task}</h2>
              <p className="text-xs text-slate-500 mb-6">{selectedTask.description || 'No description provided.'}</p>

              <div className="space-y-4 text-xs">
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-400 font-medium">Project</span>
                  <span className="text-slate-800 font-bold">{selectedTask.project}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-400 font-medium">Assignee</span>
                  <span className="text-slate-800 font-semibold">{selectedTask.assignee}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-400 font-medium">Status</span>
                  <span className="text-slate-800 font-semibold capitalize">{selectedTask.status}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-400 font-medium">Target ETA</span>
                  <span className="text-violet-600 font-bold">{selectedTask.eta_str || '-'}</span>
                </div>
                {selectedTask.sheet && (
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-400 font-medium">SharePoint Sheet</span>
                    <span className="text-slate-700 font-mono bg-slate-100 px-2 py-0.5 rounded text-[11px]">{selectedTask.sheet}</span>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => setSelectedTask(null)}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl transition-all shadow-sm"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

