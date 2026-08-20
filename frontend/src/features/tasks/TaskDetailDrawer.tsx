import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Task, TaskActivity, TaskComment } from '../../types';
import { taskApi, orgApi } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import { Avatar, Button, Textarea } from '../../components/ui';
import { PRIORITY_CONFIG, TASK_STATUS_CONFIG, formatDate } from '../../utils';
import {
  X, ChevronRight, MessageSquare, Activity, Plus,
  CheckSquare, Square, Clock, Calendar, User, Layers,
  Trash2, AlertCircle, RefreshCw,
} from 'lucide-react';

interface TaskDetailDrawerProps {
  task: Task | null;
  onClose: () => void;
}

// ── Section wrapper ───────────────────────────────────────
function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="border-t border-slate-100 pt-5 pb-1">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
        {icon}{title}
      </p>
      {children}
    </div>
  );
}

// ── Inline property row ────────────────────────────────────
function PropRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-1.5 group">
      <span className="text-xs text-slate-400 w-24 flex-shrink-0">{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  );
}

export default function TaskDetailDrawer({ task, onClose }: TaskDetailDrawerProps) {
  const { orgId, user } = useAuthStore();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<'details' | 'activity'>('details');
  const [newComment, setNewComment] = useState('');
  const [newSubtask, setNewSubtask] = useState('');
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState('');
  const [isEditingReason, setIsEditingReason] = useState(false);
  const [reasonValue, setReasonValue] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['tasks'] });
    qc.invalidateQueries({ queryKey: ['my-tasks'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const { data: comments = [] } = useQuery<TaskComment[]>({
    queryKey: ['comments', task?.id],
    queryFn: async () => (await taskApi.comments(task!.id)).data,
    enabled: !!task?.id,
  });

  const { data: subtasks = [] } = useQuery<Task[]>({
    queryKey: ['subtasks', task?.id],
    queryFn: async () => (await taskApi.subtasks(task!.id)).data,
    enabled: !!task?.id,
  });

  const { data: activityLog = [] } = useQuery<TaskActivity[]>({
    queryKey: ['activity', task?.id],
    queryFn: async () => (await taskApi.activity(task!.id)).data,
    enabled: !!task?.id && activeTab === 'activity',
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees', orgId],
    queryFn: async () => (await orgApi.employees(orgId!)).data,
    enabled: !!orgId,
  });

  const updateTask = useMutation({
    mutationFn: (data: any) => taskApi.update(task!.id, data),
    onSuccess: () => invalidateAll(),
  });

  const deleteTask = useMutation({
    mutationFn: () => taskApi.delete(task!.id),
    onSuccess: () => { invalidateAll(); onClose(); },
  });

  const addComment = useMutation({
    mutationFn: () => taskApi.addComment(task!.id, newComment),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comments', task?.id] });
      qc.invalidateQueries({ queryKey: ['activity', task?.id] });
      setNewComment('');
    },
  });

  const createSubtask = useMutation({
    mutationFn: (title: string) =>
      taskApi.createSubtask(task!.id, { title, status: 'not_started', priority: 'medium' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subtasks', task?.id] });
      invalidateAll();
      setNewSubtask('');
      setAddingSubtask(false);
    },
  });

  const updateSubtask = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => taskApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subtasks', task?.id] }),
  });

  if (!task) return null;

  const pc = PRIORITY_CONFIG[task.priority];
  const sc = TASK_STATUS_CONFIG[task.status];
  const isOverdue = task.due_date && task.status !== 'completed' && task.status !== 'cancelled'
    && new Date(task.due_date) < new Date();

  return (
    <div
      className="fixed inset-0 z-50 flex"
      onKeyDown={e => e.key === 'Escape' && onClose()}
      tabIndex={-1}
    >
      {/* Backdrop */}
      <div className="flex-1 bg-black/25 backdrop-blur-[2px]" onClick={onClose} />

      {/* Drawer */}
      <div className="w-[560px] bg-white shadow-2xl flex flex-col overflow-hidden border-l border-slate-200 animate-in slide-in-from-right duration-200">

        {/* ── Header ─────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-100 bg-slate-50/60 flex-shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>Task</span>
            <ChevronRight size={12} />
            <span className="text-violet-600 font-semibold">#{task.project_task_number || task.id}</span>
            {task.project_name && (
              <>
                <ChevronRight size={12} />
                <span className="text-slate-600 font-medium truncate max-w-[140px]">{task.project_name}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              title="Delete task"
            >
              <Trash2 size={15} />
            </button>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ── Delete confirmation ────────────────────────── */}
        {showDeleteConfirm && (
          <div className="flex-shrink-0 mx-6 mt-4 bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-700">Delete this task?</p>
                <p className="text-xs text-red-500 mt-0.5">This action cannot be undone.</p>
                <div className="flex gap-2 mt-3">
                  <Button variant="danger" size="sm" loading={deleteTask.isPending} onClick={() => deleteTask.mutate()}>
                    Delete Task
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Tabs ───────────────────────────────────────── */}
        <div className="flex border-b border-slate-100 px-6 flex-shrink-0">
          {([
            { key: 'details', label: 'Details' },
            { key: 'activity', label: 'Activity' },
          ] as const).map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={[
                'px-1 py-3 text-xs font-semibold border-b-2 mr-5 transition-colors cursor-pointer',
                activeTab === t.key
                  ? 'border-violet-500 text-violet-700'
                  : 'border-transparent text-slate-400 hover:text-slate-700',
              ].join(' ')}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Scrollable content ─────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-6 py-5 space-y-1">

            {/* Title */}
            {isEditingTitle ? (
              <input
                autoFocus
                value={titleValue}
                onChange={e => setTitleValue(e.target.value)}
                onBlur={() => {
                  if (titleValue.trim() && titleValue !== task.title) updateTask.mutate({ title: titleValue });
                  setIsEditingTitle(false);
                }}
                onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                className="w-full text-xl font-bold text-slate-900 border-b-2 border-violet-400 outline-none bg-transparent pb-1 mb-4"
              />
            ) : (
              <h2
                className="text-xl font-bold text-slate-900 mb-4 cursor-text hover:text-violet-700 transition-colors leading-snug"
                onClick={() => { setTitleValue(task.title); setIsEditingTitle(true); }}
                title="Click to edit"
              >
                {task.title}
              </h2>
            )}

            {/* Status + Priority + ETA chips */}
            <div className="flex items-center gap-2 mb-5 flex-wrap">
              <select
                value={task.status}
                onChange={e => updateTask.mutate({ status: e.target.value })}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full border-0 cursor-pointer outline-none focus:ring-2 focus:ring-violet-300 ${sc.bg} ${sc.color}`}
              >
                {Object.entries(TASK_STATUS_CONFIG).map(([val, cfg]) => (
                  <option key={val} value={val}>{cfg.label}</option>
                ))}
              </select>

              <select
                value={task.priority}
                onChange={e => updateTask.mutate({ priority: e.target.value })}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full border cursor-pointer outline-none focus:ring-2 focus:ring-violet-300 bg-white ${pc.color.split(' ')[0]}`}
              >
                {Object.entries(PRIORITY_CONFIG).map(([val, cfg]) => (
                  <option key={val} value={val}>{cfg.label}</option>
                ))}
              </select>

              {/* ETA Badge */}
              {task.eta_status && (
                <span className={`text-xs font-bold px-3 py-1.5 rounded-full border flex items-center gap-1.5 ${
                  task.eta_status === 'completed' ? 'bg-slate-100 border-slate-200 text-slate-600' :
                  task.eta_status === 'blocked' ? 'bg-purple-100 border-purple-200 text-purple-700' :
                  task.eta_status === 'delayed' ? 'bg-rose-100 border-rose-200 text-rose-700' :
                  task.eta_status === 'at_risk' ? 'bg-amber-100 border-amber-200 text-amber-700' :
                  'bg-emerald-100 border-emerald-200 text-emerald-700'
                }`}>
                  <Clock size={12} />
                  <span>ETA: {task.eta_status.replace('_', ' ').toUpperCase()} ({task.eta_date || task.due_date || 'N/A'})</span>
                </span>
              )}

              {task.is_overdue && (
                <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-red-100 text-red-600 flex items-center gap-1">
                  <Clock size={11} /> Overdue
                </span>
              )}
            </div>

            {activeTab === 'details' && (
              <>
                {/* ── Rework Info ────────────────────────── */}
                {task.rework_count ? (
                  <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <div className="flex items-center gap-2 text-amber-700 font-semibold text-sm mb-1">
                      <RefreshCw size={14} />
                      <span>Rework Tracking (Count: {task.rework_count})</span>
                      {task.is_reopened && (
                        <span className="text-[10px] font-bold bg-amber-600 text-white px-1.5 py-0.5 rounded-full ml-1">ACTIVE</span>
                      )}
                    </div>
                    {task.is_reopened && (
                      <div className="mt-2">
                        <span className="font-semibold block mb-0.5 text-amber-900 text-xs">TL Comment / Reason:</span>
                        {isEditingReason ? (
                          <Textarea
                            autoFocus
                            value={reasonValue}
                            onChange={e => setReasonValue(e.target.value)}
                            onBlur={() => {
                              if (reasonValue.trim() && reasonValue !== task.reopen_reason) {
                                updateTask.mutate({ reopen_reason: reasonValue });
                              }
                              setIsEditingReason(false);
                            }}
                            className="text-xs bg-white border-amber-300 focus:ring-amber-400 mt-1"
                            rows={2}
                          />
                        ) : (
                          <p 
                            className={`text-xs text-amber-800 bg-amber-100/50 p-2 rounded border border-amber-100 ${
                              ['team_lead', 'manager', 'admin', 'super_admin'].includes(user?.role || '') || task.project_manager_user_id === user?.id
                                ? 'cursor-pointer hover:bg-amber-100/80 hover:border-amber-300 transition-colors' 
                                : ''
                            }`}
                            onClick={() => {
                              if (['team_lead', 'manager', 'admin', 'super_admin'].includes(user?.role || '') || task.project_manager_user_id === user?.id) {
                                setReasonValue(task.reopen_reason || '');
                                setIsEditingReason(true);
                              }
                            }}
                            title={['team_lead', 'manager', 'admin', 'super_admin'].includes(user?.role || '') || task.project_manager_user_id === user?.id ? "Click to edit reason" : undefined}
                          >
                            {task.reopen_reason || <span className="italic opacity-70">No reason provided</span>}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ) : null}

                {/* ── Properties ─────────────────────────── */}
                <div className="bg-slate-50/60 rounded-xl px-4 py-1 mb-2">
                  <PropRow label="Assignee">
                    <select
                      value={task.assignee_id ?? ''}
                      onChange={e => updateTask.mutate({ assignee_id: e.target.value ? Number(e.target.value) : null })}
                      className="text-xs text-slate-700 px-2 py-1 rounded-lg border border-slate-200 bg-white cursor-pointer outline-none focus:ring-1 focus:ring-violet-400 w-full max-w-[220px]"
                    >
                      <option value="">Unassigned</option>
                      {(employees as any[]).map((emp) => (
                        <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                      ))}
                    </select>
                  </PropRow>

                  <PropRow label="Due date">
                    <input
                      type="date"
                      value={task.due_date ?? ''}
                      onChange={e => updateTask.mutate({ due_date: e.target.value || null })}
                      className="text-xs text-slate-700 px-2 py-1 rounded-lg border border-slate-200 bg-white cursor-pointer outline-none focus:ring-1 focus:ring-violet-400"
                    />
                  </PropRow>

                  <PropRow label="Start date">
                    <input
                      type="date"
                      value={task.start_date ?? ''}
                      onChange={e => updateTask.mutate({ start_date: e.target.value || null })}
                      className="text-xs text-slate-700 px-2 py-1 rounded-lg border border-slate-200 bg-white cursor-pointer outline-none focus:ring-1 focus:ring-violet-400"
                    />
                  </PropRow>

                  <PropRow label="Estimate">
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      placeholder="0 hrs"
                      defaultValue={task.estimated_hours ?? ''}
                      onBlur={e => updateTask.mutate({ estimated_hours: e.target.value ? Number(e.target.value) : null })}
                      className="text-xs text-slate-700 px-2 py-1 rounded-lg border border-slate-200 bg-white outline-none focus:ring-1 focus:ring-violet-400 w-24"
                    />
                    <span className="text-xs text-slate-400 ml-1.5">hours</span>
                  </PropRow>

                  {task.completed_at && (
                    <PropRow label="Completed">
                      <span className="text-xs text-green-600 font-medium">{formatDate(task.completed_at)}</span>
                    </PropRow>
                  )}
                </div>

                {/* ── Description ────────────────────────── */}
                <Section title="Description" icon={<Layers size={12} />}>
                  <Textarea
                    placeholder="Add a description..."
                    rows={3}
                    defaultValue={task.description ?? ''}
                    onBlur={e => {
                      if (e.target.value !== task.description) updateTask.mutate({ description: e.target.value });
                    }}
                  />
                </Section>


                {/* ── Subtasks ────────────────────────────── */}
                <Section title={`Subtasks${task.subtask_count ? ` · ${task.completed_subtask_count}/${task.subtask_count}` : ''}`} icon={<CheckSquare size={12} />}>
                  <div className="space-y-1 mb-3">
                    {subtasks.map((sub: Task) => {
                      const ssc = TASK_STATUS_CONFIG[sub.status];
                      return (
                        <div key={sub.id} className="flex items-center gap-2 group py-1 px-2 rounded-lg hover:bg-slate-50 transition-colors">
                          <button
                            onClick={() => updateSubtask.mutate({
                              id: sub.id,
                              data: { status: sub.status === 'completed' ? 'not_started' : 'completed' }
                            })}
                            className="text-slate-400 hover:text-violet-600 flex-shrink-0 transition-colors"
                          >
                            {sub.status === 'completed'
                              ? <CheckSquare size={15} className="text-green-500" />
                              : <Square size={15} />}
                          </button>
                          <span className={`text-sm flex-1 ${sub.status === 'completed' ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                            {sub.title}
                          </span>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${ssc.bg} ${ssc.color} opacity-0 group-hover:opacity-100 transition-opacity`}>
                            {ssc.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {addingSubtask ? (
                    <div className="flex gap-2">
                      <input
                        autoFocus
                        type="text"
                        placeholder="Subtask title..."
                        value={newSubtask}
                        onChange={e => setNewSubtask(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && newSubtask.trim()) createSubtask.mutate(newSubtask.trim());
                          if (e.key === 'Escape') { setAddingSubtask(false); setNewSubtask(''); }
                        }}
                        className="flex-1 text-sm px-3 py-1.5 border border-violet-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300"
                      />
                      <Button variant="primary" size="sm" loading={createSubtask.isPending}
                        onClick={() => newSubtask.trim() && createSubtask.mutate(newSubtask.trim())}>
                        Add
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => { setAddingSubtask(false); setNewSubtask(''); }}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAddingSubtask(true)}
                      className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-violet-600 hover:bg-violet-50 px-2 py-1.5 rounded-lg transition-colors w-full"
                    >
                      <Plus size={13} /> Add subtask
                    </button>
                  )}
                </Section>

                {/* ── Comments ────────────────────────────── */}
                <Section title={`Comments${comments.length ? ` (${comments.length})` : ''}`} icon={<MessageSquare size={12} />}>
                  <div className="space-y-3 mb-4">
                    {comments.map((c: TaskComment) => (
                      <div key={c.id} className="flex gap-3">
                        <Avatar name={c.author_name ?? ''} size="xs" className="flex-shrink-0 mt-0.5" />
                        <div className="flex-1 bg-slate-50 rounded-xl px-3 py-2.5">
                          <div className="flex items-baseline justify-between gap-2 mb-1">
                            <p className="text-xs font-semibold text-slate-700">{c.author_name}</p>
                            <p className="text-[10px] text-slate-400">{formatDate(c.created_at)}</p>
                          </div>
                          <p className="text-sm text-slate-600 leading-relaxed">{c.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Write a comment..."
                      value={newComment}
                      onChange={e => setNewComment(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && newComment.trim() && addComment.mutate()}
                      className="flex-1 text-sm px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-300 placeholder:text-slate-400"
                    />
                    <Button variant="primary" size="sm" onClick={() => addComment.mutate()}
                      disabled={!newComment.trim()} loading={addComment.isPending}>
                      Send
                    </Button>
                  </div>
                </Section>
              </>
            )}

            {/* ── Activity tab ─────────────────────────── */}
            {activeTab === 'activity' && (
              <div className="pt-2">
                {activityLog.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-8">No activity yet.</p>
                ) : (
                  <div className="space-y-3">
                    {activityLog.map((entry: TaskActivity) => (
                      <div key={entry.id} className="flex gap-3">
                        <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Activity size={12} className="text-violet-500" />
                        </div>
                        <div className="flex-1 pt-0.5">
                          <p className="text-sm text-slate-700 leading-snug">
                            <span className="font-semibold">{entry.actor_name ?? 'Someone'}</span>{' '}
                            {entry.description}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5">{formatDate(entry.created_at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
