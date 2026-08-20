import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { projectApi } from '../../services/api';
import type { Task, Milestone, TaskDependency } from '../../types';
import { Spinner, Avatar, Badge } from '../../components/ui';
import { TASK_STATUS_CONFIG, PRIORITY_CONFIG, formatDate } from '../../utils';
import { Diamond, ArrowRight } from 'lucide-react';

interface ProjectGanttViewProps {
  projectId: number;
  onSelectTask: (task: Task) => void;
}

export default function ProjectGanttView({ projectId, onSelectTask }: ProjectGanttViewProps) {
  const [zoom, setZoom] = useState<'day' | 'week' | 'month'>('week');

  const { data, isLoading } = useQuery({
    queryKey: ['gantt', projectId],
    queryFn: async () => {
      const r = await projectApi.getGantt(projectId);
      return r.data;
    },
    enabled: !!projectId,
  });

  const tasks: Task[] = data?.tasks || [];
  const milestones: Milestone[] = data?.milestones || [];
  const dependencies: TaskDependency[] = data?.dependencies || [];

  // Map task dependencies lookup
  const depsMap = useMemo(() => {
    const map: Record<number, { blocking: string[]; blockedBy: string[] }> = {};
    dependencies.forEach(d => {
      if (!map[d.source_task_id]) map[d.source_task_id] = { blocking: [], blockedBy: [] };
      if (!map[d.target_task_id]) map[d.target_task_id] = { blocking: [], blockedBy: [] };

      if (d.target_task_title) map[d.source_task_id].blocking.push(d.target_task_title);
      if (d.source_task_title) map[d.target_task_id].blockedBy.push(d.source_task_title);
    });
    return map;
  }, [dependencies]);

  // Date scale calculations
  const { startDate, datesHeader } = useMemo(() => {
    let minDate = new Date();
    let maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 30);

    tasks.forEach(t => {
      if (t.start_date) { const d = new Date(t.start_date); if (d < minDate) minDate = d; }
      if (t.due_date) { const d = new Date(t.due_date); if (d > maxDate) maxDate = d; }
    });

    const start = new Date(minDate);
    start.setDate(start.getDate() - 3);
    const end = new Date(maxDate);
    end.setDate(end.getDate() + 7);

    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24));
    const header: Date[] = [];
    for (let i = 0; i <= days; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      header.push(d);
    }
    return { startDate: start, datesHeader: header };
  }, [tasks]);

  const dayWidth = zoom === 'day' ? 44 : zoom === 'week' ? 22 : 12;

  const getPos = (dateStr?: string | null) => {
    if (!dateStr) return 0;
    const d = new Date(dateStr);
    const diff = Math.max(0, Math.ceil((d.getTime() - startDate.getTime()) / (1000 * 3600 * 24)));
    return diff * dayWidth;
  };

  const getBarWidth = (startStr?: string | null, dueStr?: string | null) => {
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
      {/* Control Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900">Gantt Chart & Dependency Management</h2>
          <p className="text-xs text-slate-500">Inspect critical path, schedule bounds, and dependency constraints</p>
        </div>

        {/* Zoom selector */}
        <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
          {(['day', 'week', 'month'] as const).map(z => (
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

      {/* Main Split Layout: Left Table + Right Gantt Chart */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side: Task Hierarchy Table */}
        <div className="w-1/2 border-r border-slate-200 bg-white overflow-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider sticky top-0 z-10">
                <th className="px-4 py-3">Task Name</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Assignee</th>
                <th className="px-3 py-3">Dates</th>
                <th className="px-3 py-3">Dependencies</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {/* Milestones Header rows */}
              {milestones.map(m => (
                <tr key={`m-${m.id}`} className="bg-amber-50/40 font-semibold text-amber-900">
                  <td className="px-4 py-2.5 flex items-center gap-2">
                    <Diamond size={14} className="text-amber-500 fill-current" />
                    <span>{m.name}</span>
                  </td>
                  <td className="px-3 py-2.5" colSpan={2}>
                    <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">Milestone</span>
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">{formatDate(m.target_date)}</td>
                  <td className="px-3 py-2.5 text-slate-400">—</td>
                </tr>
              ))}

              {/* Task rows */}
              {tasks.map(task => {
                const depInfo = depsMap[task.id];
                return (
                  <tr
                    key={task.id}
                    onClick={() => onSelectTask(task)}
                    className="hover:bg-violet-50/40 cursor-pointer transition-colors group"
                  >
                    <td className="px-4 py-3 font-semibold text-slate-800 group-hover:text-violet-700 max-w-xs truncate">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${PRIORITY_CONFIG[task.priority].dot}`} />
                        <span className="truncate">{task.title}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <Badge className={TASK_STATUS_CONFIG[task.status].color}>
                        {TASK_STATUS_CONFIG[task.status].label}
                      </Badge>
                    </td>
                    <td className="px-3 py-3">
                      {task.assignee_name ? (
                        <div className="flex items-center gap-1.5">
                          <Avatar name={task.assignee_name} size="xs" />
                          <span className="text-slate-600 text-xs truncate max-w-[90px]">{task.assignee_name}</span>
                        </div>
                      ) : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-3 py-3 text-slate-500 text-[11px] whitespace-nowrap">
                      {task.start_date || 'N/A'} → {task.due_date || 'N/A'}
                    </td>
                    <td className="px-3 py-3 text-[11px]">
                      {depInfo?.blockedBy.length ? (
                        <span className="text-rose-600 font-semibold flex items-center gap-1">
                          <ArrowRight size={10} /> Blocked by {depInfo.blockedBy[0]}
                        </span>
                      ) : depInfo?.blocking.length ? (
                        <span className="text-purple-600 font-semibold flex items-center gap-1">
                          <ArrowRight size={10} /> Blocks {depInfo.blocking[0]}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Right Side: Interactive Gantt Chart */}
        <div className="w-1/2 bg-slate-50 overflow-auto">
          <div
            className="bg-white border-l border-slate-200 relative min-h-full"
            style={{ width: `${datesHeader.length * dayWidth}px` }}
          >
            {/* Header Dates */}
            <div className="flex border-b border-slate-200 bg-slate-100 sticky top-0 z-10">
              {datesHeader.map((d, i) => {
                const isToday = d.toISOString().split('T')[0] === new Date().toISOString().split('T')[0];
                return (
                  <div
                    key={i}
                    style={{ width: `${dayWidth}px` }}
                    className={`py-2 border-r border-slate-200/60 text-center flex-shrink-0 ${
                      isToday ? 'bg-violet-200/50 font-bold' : ''
                    }`}
                  >
                    <span className="text-[9px] font-bold text-slate-400 block uppercase">
                      {d.toLocaleDateString('default', { weekday: 'narrow' })}
                    </span>
                    <span className={`text-xs ${isToday ? 'text-violet-700 font-extrabold' : 'text-slate-700 font-bold'}`}>
                      {d.getDate()}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Milestones Chart markers */}
            {milestones.map(m => {
              const leftPos = getPos(m.target_date);
              return (
                <div key={`gm-${m.id}`} className="h-10 border-b border-slate-100 relative bg-amber-50/20">
                  <div
                    style={{ left: `${leftPos}px` }}
                    className="absolute top-2 bg-amber-500 text-white px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 shadow-sm -translate-x-1/2 z-10"
                  >
                    <Diamond size={10} className="fill-current" />
                    <span>{m.name}</span>
                  </div>
                </div>
              );
            })}

            {/* Tasks Chart Bars */}
            {tasks.map(task => {
              const leftPos = getPos(task.start_date || task.due_date);
              const barWidth = getBarWidth(task.start_date, task.due_date);
              const isCompleted = task.status === 'completed';

              return (
                <div key={`gt-${task.id}`} className="h-12 border-b border-slate-100 relative flex items-center hover:bg-slate-100/50">
                  <div
                    onClick={() => onSelectTask(task)}
                    style={{ left: `${leftPos}px`, width: `${barWidth}px` }}
                    className={`absolute h-6 rounded-md ${
                      isCompleted ? 'bg-slate-400' : task.status === 'blocked' ? 'bg-purple-600' : 'bg-violet-600'
                    } text-white px-2 flex items-center justify-between text-[11px] font-semibold shadow-sm hover:brightness-110 cursor-pointer transition-all truncate`}
                  >
                    <span className="truncate">{task.title}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
