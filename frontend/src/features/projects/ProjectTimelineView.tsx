import { useState, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { projectApi } from '../../services/api';
import type { Task, Milestone, ETAStatus } from '../../types';
import { Spinner, Badge } from '../../components/ui';
import { TASK_STATUS_CONFIG, PRIORITY_CONFIG, formatDate } from '../../utils';
import { Diamond } from 'lucide-react';

interface ProjectTimelineViewProps {
  projectId: number;
  onSelectTask: (task: Task) => void;
}

type ZoomLevel = 'day' | 'week' | 'month';

const ETA_CONFIG: Record<ETAStatus, { label: string; bg: string; text: string }> = {
  on_track: { label: 'On Track', bg: 'bg-emerald-500', text: 'text-emerald-700' },
  at_risk: { label: 'At Risk', bg: 'bg-amber-500', text: 'text-amber-700' },
  delayed: { label: 'Delayed', bg: 'bg-rose-500', text: 'text-rose-700' },
  blocked: { label: 'Blocked', bg: 'bg-purple-500', text: 'text-purple-700' },
  completed: { label: 'Completed', bg: 'bg-slate-400', text: 'text-slate-600' },
};

export default function ProjectTimelineView({ projectId, onSelectTask }: ProjectTimelineViewProps) {
  const [zoom, setZoom] = useState<ZoomLevel>('week');
  const containerRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['timeline', projectId],
    queryFn: async () => {
      const r = await projectApi.getTimeline(projectId);
      return r.data;
    },
    enabled: !!projectId,
  });

  const tasks: Task[] = data?.tasks || [];
  const milestones: Milestone[] = data?.milestones || [];

  const health = data?.health_summary;

  // Calculate timeline date bounds
  const { startDate, datesHeader } = useMemo(() => {
    let minDate = new Date();
    let maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 30);

    tasks.forEach(t => {
      if (t.start_date) {
        const d = new Date(t.start_date);
        if (d < minDate) minDate = d;
      }
      if (t.due_date) {
        const d = new Date(t.due_date);
        if (d > maxDate) maxDate = d;
      }
    });

    milestones.forEach(m => {
      if (m.target_date) {
        const d = new Date(m.target_date);
        if (d > maxDate) maxDate = d;
        if (d < minDate) minDate = d;
      }
    });

    // Buffer 5 days before min and 10 days after max
    const start = new Date(minDate);
    start.setDate(start.getDate() - 5);
    const end = new Date(maxDate);
    end.setDate(end.getDate() + 10);

    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24));
    
    // Generate dates array
    const header: Date[] = [];
    for (let i = 0; i <= days; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      header.push(d);
    }

    return { startDate: start, datesHeader: header };
  }, [tasks, milestones]);

  // Width per day according to zoom level
  const dayWidth = zoom === 'day' ? 48 : zoom === 'week' ? 24 : 12;

  const getPositionForDate = (dateStr?: string | null) => {
    if (!dateStr) return 0;
    const d = new Date(dateStr);
    const diff = Math.max(0, Math.ceil((d.getTime() - startDate.getTime()) / (1000 * 3600 * 24)));
    return diff * dayWidth;
  };

  const getWidthForDuration = (startStr?: string | null, dueStr?: string | null) => {
    if (!startStr || !dueStr) return dayWidth * 3;
    const s = new Date(startStr);
    const d = new Date(dueStr);
    const diff = Math.max(1, Math.ceil((d.getTime() - s.getTime()) / (1000 * 3600 * 24)) + 1);
    return diff * dayWidth;
  };

  if (isLoading) {
    return <div className="flex justify-center py-20"><Spinner className="w-8 h-8 text-violet-600" /></div>;
  }

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Top Header & Health Summary */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <div>
            <h2 className="text-base font-bold text-slate-900">Project Timeline & Workflow Progress</h2>
            <p className="text-xs text-slate-500">Visualize tasks, milestones, and dependencies across time</p>
          </div>

          {health && (
            <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs">
              <div className="flex items-center gap-1.5 font-bold">
                <span className={`w-2.5 h-2.5 rounded-full ${
                  health.health_status === 'On Track' ? 'bg-emerald-500' : health.health_status === 'At Risk' ? 'bg-amber-500' : 'bg-rose-500'
                }`} />
                <span className="text-slate-800">{health.health_status}</span>
              </div>
              <span className="text-slate-300">|</span>
              <span className="text-slate-600 font-medium">{health.overall_progress}% Progress</span>
              <span className="text-slate-300">|</span>
              {health.overdue_count > 0 && <span className="text-rose-600 font-semibold">{health.overdue_count} Overdue</span>}
              {health.delayed_count > 0 && <span className="text-amber-600 font-semibold">{health.delayed_count} Delayed</span>}
            </div>
          )}
        </div>

        {/* Zoom Switcher */}
        <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
          {(['day', 'week', 'month'] as ZoomLevel[]).map(z => (
            <button
              key={z}
              onClick={() => setZoom(z)}
              className={`px-3 py-1 text-xs font-semibold rounded-md capitalize transition-all ${
                zoom === z ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {z}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline Scrollable Axis Area */}
      <div className="flex-1 overflow-auto p-6" ref={containerRef}>
        <div
          className="bg-white border border-slate-200 rounded-xl shadow-sm relative min-h-[500px]"
          style={{ width: `${datesHeader.length * dayWidth + 280}px` }}
        >
          {/* Header Row: Left Sidebar Title + Date Axis */}
          <div className="flex border-b border-slate-200 bg-slate-50 sticky top-0 z-10">
            <div className="w-70 px-4 py-3 font-bold text-xs text-slate-600 uppercase tracking-wider border-r border-slate-200 bg-slate-50 flex-shrink-0">
              Task / Milestone
            </div>
            <div className="flex flex-1 overflow-hidden">
              {datesHeader.map((d, i) => {
                const isToday = d.toISOString().split('T')[0] === new Date().toISOString().split('T')[0];
                const isFirstOfMonth = d.getDate() === 1;

                return (
                  <div
                    key={i}
                    style={{ width: `${dayWidth}px` }}
                    className={`flex flex-col items-center justify-center py-2 border-r border-slate-100 flex-shrink-0 ${
                      isToday ? 'bg-violet-100/50' : isFirstOfMonth ? 'bg-slate-100' : ''
                    }`}
                  >
                    <span className="text-[10px] font-semibold text-slate-400">
                      {d.toLocaleDateString('default', { weekday: 'narrow' })}
                    </span>
                    <span className={`text-xs font-bold ${isToday ? 'text-violet-700' : 'text-slate-700'}`}>
                      {d.getDate()}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Milestones Rows */}
          {milestones.map(m => {
            const leftPos = getPositionForDate(m.target_date);
            return (
              <div key={m.id} className="flex border-b border-slate-100 hover:bg-amber-50/20 transition-colors group">
                <div className="w-70 px-4 py-3 border-r border-slate-200 font-semibold text-xs text-amber-900 flex items-center gap-2 flex-shrink-0 bg-amber-50/30">
                  <Diamond size={14} className="text-amber-500 fill-current flex-shrink-0" />
                  <span className="truncate">{m.name}</span>
                </div>
                <div className="flex-1 relative h-10 flex items-center">
                  <div
                    style={{ left: `${leftPos}px` }}
                    className="absolute flex items-center gap-1 bg-amber-500 text-white px-2 py-1 rounded-md text-xs font-bold shadow-sm -translate-x-1/2 z-10"
                  >
                    <Diamond size={12} className="fill-current" />
                    <span>{m.name} ({formatDate(m.target_date)})</span>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Tasks Rows */}
          {tasks.map(task => {
            const leftPos = getPositionForDate(task.start_date || task.due_date);
            const barWidth = getWidthForDuration(task.start_date, task.due_date);
            const etaBg = ETA_CONFIG[task.eta_status || 'on_track'].bg;

            return (
              <div key={task.id} className="flex border-b border-slate-100 hover:bg-slate-50 transition-colors group">
                {/* Left side info */}
                <div
                  onClick={() => onSelectTask(task)}
                  className="w-70 px-4 py-3 border-r border-slate-200 font-medium text-xs text-slate-800 flex items-center justify-between flex-shrink-0 cursor-pointer hover:text-violet-700"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${PRIORITY_CONFIG[task.priority].dot}`} />
                    <span className="truncate font-semibold">{task.title}</span>
                  </div>
                  <Badge className={TASK_STATUS_CONFIG[task.status].color}>
                    {TASK_STATUS_CONFIG[task.status].label}
                  </Badge>
                </div>

                {/* Right side bar */}
                <div className="flex-1 relative h-12 flex items-center">
                  <div
                    onClick={() => onSelectTask(task)}
                    style={{ left: `${leftPos}px`, width: `${barWidth}px` }}
                    className={`absolute h-7 rounded-lg ${etaBg} text-white px-2 flex items-center justify-between text-xs font-semibold shadow-sm hover:brightness-110 cursor-pointer transition-all truncate group/bar`}
                  >
                    <span className="truncate text-[11px] pl-1">{task.title}</span>
                    <span className="text-[10px] opacity-85 pr-1">{formatDate(task.due_date)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
