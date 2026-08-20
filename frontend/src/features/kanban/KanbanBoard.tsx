import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Task, TaskStatus } from '../../types';
import { taskApi } from '../../services/api';
import { Avatar, Modal, Button, Textarea } from '../../components/ui';
import { PRIORITY_CONFIG, formatDate } from '../../utils';
import { MessageSquare, CheckSquare, RefreshCw } from 'lucide-react';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, useDroppable, DragOverlay,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const COLUMNS: { status: TaskStatus; label: string; color: string; dot: string }[] = [
  { status: 'not_started', label: 'To Do', color: 'text-slate-600', dot: 'bg-slate-300' },
  { status: 'in_progress', label: 'In Progress', color: 'text-blue-700', dot: 'bg-blue-500' },
  { status: 'in_review', label: 'In Review', color: 'text-purple-700', dot: 'bg-purple-500' },
  { status: 'blocked', label: 'Blocked', color: 'text-red-600', dot: 'bg-red-500' },
  { status: 'completed', label: 'Done', color: 'text-green-700', dot: 'bg-green-500' },
];

function TaskCard({ task, onSelect, isOverlay }: { task: Task; onSelect: () => void; isOverlay?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const pc = PRIORITY_CONFIG[task.priority];

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging && !isOverlay ? 0.3 : 1,
  };

  return (
    <div
      ref={isOverlay ? undefined : setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onSelect}
      className={`bg-white border border-slate-200 rounded-xl p-3.5 cursor-pointer select-none ${isOverlay ? 'shadow-xl scale-105 border-violet-300 ring-2 ring-violet-500/20' : 'hover:shadow-md hover:border-violet-200 transition-all group'}`}
    >
      {/* Priority indicator */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex flex-col gap-1 flex-1">
          <div className="flex items-start gap-1.5">
            {task.project_task_number && (
              <span className="text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded mt-0.5 whitespace-nowrap">
                #{task.project_task_number}
              </span>
            )}
            <p className="text-sm font-medium text-slate-800 group-hover:text-violet-700 transition-colors leading-snug">
              {task.title}
            </p>
          </div>
          {task.is_reopened && (
            <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded w-fit flex items-center gap-1 border border-amber-200 mt-0.5">
              <RefreshCw size={10} /> REWORK #{task.rework_count}
            </span>
          )}
        </div>
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold flex-shrink-0 ${pc.color}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${pc.dot}`} />
          {pc.label}
        </span>
      </div>

      {/* Subtask progress */}
      {task.subtask_count > 0 && (
        <div className="flex items-center gap-1.5 mb-2">
          <CheckSquare size={12} className="text-slate-400" />
          <span className="text-xs text-slate-400">0/{task.subtask_count} subtasks</span>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-50">
        <div className="flex items-center gap-2">
          {task.assignee_name && (
            <Avatar name={task.assignee_name} src={task.assignee_avatar} size="xs" />
          )}
          {task.due_date && (
            <span className="text-[10px] text-slate-400">{formatDate(task.due_date)}</span>
          )}
        </div>
        <div className="flex items-center gap-2.5 text-slate-400">
          {task.comment_count > 0 && (
            <span className="flex items-center gap-1 text-[10px]">
              <MessageSquare size={11} /> {task.comment_count}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function DroppableColumn({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className="space-y-2.5 min-h-[480px] p-2.5 rounded-xl bg-slate-50/80 border border-slate-200">
      {children}
    </div>
  );
}

interface KanbanBoardProps {
  tasks: Task[];
  onSelectTask: (task: Task) => void;
  projectId: number;
  queryKeyOverride?: unknown[];
  onAddTask: (status: TaskStatus) => void;
}

export default function KanbanBoard({ tasks, onSelectTask, projectId, onAddTask, queryKeyOverride }: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<number | null>(null);
  const [reopenTaskInfo, setReopenTaskInfo] = useState<{ id: number, targetStatus: TaskStatus } | null>(null);
  const [reopenReason, setReopenReason] = useState("");
  const qc = useQueryClient();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const updateStatus = useMutation({
    mutationFn: ({ id, status, reopen_reason }: { id: number; status: TaskStatus; reopen_reason?: string }) => 
      taskApi.update(id, { status, reopen_reason }),
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: (queryKeyOverride || ['tasks', projectId]) });
      const previousTasks = qc.getQueryData((queryKeyOverride || ['tasks', projectId]));
      qc.setQueryData((queryKeyOverride || ['tasks', projectId]), (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.map((t: Task) => (t.id === id ? { ...t, status } : t));
      });
      return { previousTasks };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousTasks) {
        qc.setQueryData((queryKeyOverride || ['tasks', projectId]), context.previousTasks);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: (queryKeyOverride || ['tasks', projectId]) });
    },
  });

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as number);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const task = tasks.find(t => t.id === active.id);
    if (!task) return;

    let targetStatus: TaskStatus | undefined;

    if (COLUMNS.some(c => c.status === over.id)) {
      targetStatus = over.id as TaskStatus;
    } else {
      const overTask = tasks.find(t => t.id === over.id);
      if (overTask) {
        targetStatus = overTask.status;
      }
    }

    if (targetStatus && task.status !== targetStatus) {
      if (task.status === 'completed' && targetStatus === 'not_started') {
        setReopenTaskInfo({ id: Number(active.id), targetStatus });
        return;
      }
      updateStatus.mutate({ id: Number(active.id), status: targetStatus });
    }
  };

  const handleConfirmReopen = () => {
    if (!reopenTaskInfo || !reopenReason.trim()) return;
    updateStatus.mutate({ 
      id: reopenTaskInfo.id, 
      status: reopenTaskInfo.targetStatus, 
      reopen_reason: reopenReason 
    });
    setReopenTaskInfo(null);
    setReopenReason("");
  };

  const getColumnTasks = (status: TaskStatus) => tasks.filter(t => t.status === status);

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-5 overflow-x-auto px-8 py-6 h-full min-h-0 items-start">
        {COLUMNS.map(col => {
          const colTasks = getColumnTasks(col.status);
          return (
            <div key={col.status} className="flex-shrink-0 w-72 flex flex-col">
              {/* Column header */}
              <div className="flex items-center gap-2 mb-3 px-1">
                <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                <span className={`text-xs font-semibold uppercase tracking-wide ${col.color}`}>{col.label}</span>
                <span className="text-xs text-slate-400 bg-slate-100 rounded-full px-2 py-0.5 ml-auto">{colTasks.length}</span>
              </div>

              {/* Droppable column */}
              <SortableContext
                id={col.status}
                items={colTasks.map(t => t.id)}
                strategy={verticalListSortingStrategy}
              >
                <DroppableColumn id={col.status}>
                  {colTasks.map(task => (
                    <TaskCard key={task.id} task={task} onSelect={() => onSelectTask(task)} />
                  ))}
                  {/* Add task to this column */}
                  <button
                    onClick={() => onAddTask(col.status)}
                    className="w-full text-left px-3 py-2 text-xs text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <span className="text-base leading-none">+</span> Add task
                  </button>
                </DroppableColumn>
              </SortableContext>
            </div>
          );
        })}
      </div>
      <DragOverlay>
        {activeId ? (
          <TaskCard
            task={tasks.find(t => t.id === activeId)!}
            onSelect={() => {}}
            isOverlay
          />
        ) : null}
      </DragOverlay>

      {/* Reopen Task Dialog */}
      <Modal 
        open={!!reopenTaskInfo} 
        onClose={() => { setReopenTaskInfo(null); setReopenReason(""); }}
        title="Reopen Task"
      >
        <div className="p-6">
          <p className="text-sm text-slate-600 mb-4">
            This task has already been marked as completed. Please provide a reason for reopening it.
          </p>
          <Textarea 
            label="Reason"
            placeholder="e.g. Needs rework on..."
            value={reopenReason}
            onChange={(e) => setReopenReason(e.target.value)}
            rows={3}
          />
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="ghost" onClick={() => { setReopenTaskInfo(null); setReopenReason(""); }}>
              Cancel
            </Button>
            <Button 
              variant="primary" 
              onClick={handleConfirmReopen}
              disabled={!reopenReason.trim()}
            >
              Reopen Task
            </Button>
          </div>
        </div>
      </Modal>
    </DndContext>
  );
}
