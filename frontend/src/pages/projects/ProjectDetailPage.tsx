import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/authStore';
import { projectApi, taskApi, orgApi } from '../../services/api';
import type { Project, Task, TaskStatus, Priority } from '../../types';
import {
  Button, Badge, ProgressBar, Avatar, Spinner, EmptyState, Modal, Input, Textarea, Select,
} from '../../components/ui';
import KanbanBoard from '../../features/kanban/KanbanBoard';
import TaskDetailDrawer from '../../features/tasks/TaskDetailDrawer';
import ProjectCalendarView from '../../features/projects/ProjectCalendarView';
import ProjectTimelineView from '../../features/projects/ProjectTimelineView';
import ProjectGanttView from '../../features/projects/ProjectGanttView';
import ProjectMilestonesView from '../../features/projects/ProjectMilestonesView';
import { PROJECT_STATUS_CONFIG, PRIORITY_CONFIG, TASK_STATUS_CONFIG, formatDate, getProjectProgress } from '../../utils';
import { Plus, Kanban, List, CheckCircle2, ArrowLeft, Calendar as CalendarIcon, GanttChart, Diamond, Layers, Edit } from 'lucide-react';
import EditProjectModal from './EditProjectModal';

function CreateTaskModal({
  open, onClose, projectId, defaultStatus, defaultDate,
}: {
  open: boolean; onClose: () => void; projectId: number; defaultStatus: TaskStatus; defaultDate?: string;
}) {
  const { orgId } = useAuthStore();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    title: '', description: '', priority: 'medium' as Priority,
    status: defaultStatus, due_date: defaultDate || '', start_date: defaultDate || '', assignee_id: '',
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees', orgId],
    queryFn: async () => { const r = await orgApi.employees(orgId!); return r.data; },
    enabled: !!orgId,
  });

  const mutation = useMutation({
    mutationFn: () => taskApi.create(projectId, {
      ...form,
      assignee_id: form.assignee_id ? Number(form.assignee_id) : null,
      due_date: form.due_date || null,
      start_date: form.start_date || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', projectId] });
      qc.invalidateQueries({ queryKey: ['calendar', projectId] });
      onClose();
      setForm({ title: '', description: '', priority: 'medium', status: defaultStatus, due_date: '', start_date: '', assignee_id: '' });
    },
  });

  const update = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <Modal open={open} onClose={onClose} title="Create task">
      <div className="px-6 py-5 space-y-4">
        <Input id="task-title" label="Title *" placeholder="What needs to be done?" value={form.title} onChange={e => update('title', e.target.value)} autoFocus />
        <Textarea id="task-desc" label="Description" placeholder="More details..." rows={3} value={form.description} onChange={e => update('description', e.target.value)} />
        <div className="grid grid-cols-2 gap-4">
          <Select id="task-status" label="Status" value={form.status} onChange={e => update('status', e.target.value)}>
            {Object.entries(TASK_STATUS_CONFIG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
          </Select>
          <Select id="task-priority" label="Priority" value={form.priority} onChange={e => update('priority', e.target.value)}>
            {Object.entries(PRIORITY_CONFIG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Select id="task-assignee" label="Assignee" value={form.assignee_id} onChange={e => update('assignee_id', e.target.value)}>
            <option value="">Unassigned</option>
            {employees.map((emp: any) => <option key={emp.id} value={emp.id}>{emp.full_name}</option>)}
          </Select>
          <Input id="task-due" label="Due date" type="date" value={form.due_date} onChange={e => update('due_date', e.target.value)} />
        </div>
        <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={mutation.isPending} onClick={() => mutation.mutate()} disabled={!form.title.trim()}>
            Create Task
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ListViewRow({ task, onSelect }: { task: Task; onSelect: () => void }) {
  const pc = PRIORITY_CONFIG[task.priority];
  const sc = TASK_STATUS_CONFIG[task.status];
  return (
    <tr onClick={onSelect} className="hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0 transition-colors group">
      <td className="px-4 py-3 text-sm font-medium text-slate-700 group-hover:text-violet-700 transition-colors max-w-xs truncate flex items-center gap-2">
        {task.project_task_number && (
          <span className="text-[10px] font-bold text-slate-400 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded whitespace-nowrap">
            #{task.project_task_number}
          </span>
        )}
        <span className="truncate">{task.title}</span>
      </td>
      <td className="px-4 py-3">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${sc.bg} ${sc.color}`}>{sc.label}</span>
      </td>
      <td className="px-4 py-3">
        <span className={`text-xs font-semibold flex items-center gap-1 ${pc.color.split(' ')[0]}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${pc.dot}`} />{pc.label}
        </span>
      </td>
      <td className="px-4 py-3">
        {task.assignee_name ? (
          <div className="flex items-center gap-2">
            <Avatar name={task.assignee_name} size="xs" />
            <span className="text-xs text-slate-600">{task.assignee_name}</span>
          </div>
        ) : <span className="text-xs text-slate-400">—</span>}
      </td>
      <td className="px-4 py-3 text-xs text-slate-500">{formatDate(task.due_date)}</td>
    </tr>
  );
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'board' | 'list' | 'calendar' | 'timeline' | 'gantt' | 'milestones' | 'overview'>('board');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [defaultStatus, setDefaultStatus] = useState<TaskStatus>('not_started');
  const [createDate, setCreateDate] = useState<string>('');

  const { data: project, isLoading: projLoading } = useQuery<Project>({
    queryKey: ['project', projectId],
    queryFn: async () => { const r = await projectApi.get(projectId); return r.data; },
    enabled: !!projectId,
  });

  const { data: rawTasks, isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ['tasks', projectId],
    queryFn: async () => {
      const r = await taskApi.list(projectId);
      return Array.isArray(r.data) ? r.data : [];
    },
    enabled: !!projectId,
  });

  const tasks = Array.isArray(rawTasks) ? rawTasks : [];

  const updateProjectStatus = useMutation({
    mutationFn: (status: string) => projectApi.update(projectId, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project', projectId] }),
  });

  if (projLoading) return <div className="flex items-center justify-center py-20"><Spinner className="w-8 h-8" /></div>;
  if (!project) return <div className="p-8 text-slate-500">Project not found</div>;

  const progress = getProjectProgress(project.task_count, project.completed_task_count);
  const sc = PROJECT_STATUS_CONFIG[project.status];
  const pc = PRIORITY_CONFIG[project.priority];

  const handleAddTask = (status: TaskStatus, dateStr?: string) => {
    setDefaultStatus(status);
    if (dateStr) setCreateDate(dateStr);
    setCreateOpen(true);
  };

  return (
    <div className="flex flex-col" style={{ height: '100%' }}>
      {/* Project header */}
      <div className="bg-white border-b border-slate-200 px-8 pt-6 pb-0 flex-shrink-0">
        {/* Top row: back + title + actions */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-start gap-4">
            <button
              onClick={() => navigate(-1)}
              title="Go Back"
              className="group mt-0.5 flex items-center justify-center w-8 h-8 rounded-full border border-slate-200 bg-white text-slate-400 hover:text-slate-700 hover:border-slate-300 shadow-sm hover:shadow transition-all flex-shrink-0"
            >
              <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <Badge className={sc.color}>{sc.label}</Badge>
                <Badge className={pc.color}>{pc.label}</Badge>
                <span className="text-xs text-slate-400 capitalize">{project.work_mode.replace('_', ' + ')}</span>
              </div>
              <h1 className="text-2xl font-bold text-slate-900 leading-tight truncate">{project.name}</h1>
              {project.description && <p className="text-sm text-slate-500 mt-0.5 line-clamp-1">{project.description}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
            <select
              value={project.status}
              onChange={e => updateProjectStatus.mutate(e.target.value)}
              className="text-xs text-slate-600 border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-violet-400"
            >
              {Object.entries(PROJECT_STATUS_CONFIG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
            </select>
            <Button variant="ghost" size="sm" onClick={() => setEditOpen(true)} className="px-2">
              <Edit size={14} className="text-slate-500 hover:text-slate-700" />
            </Button>
            <Button variant="primary" size="sm" onClick={() => handleAddTask('not_started')}>
              <Plus size={14} /> Add Task
            </Button>
          </div>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-3 mb-4">
          <ProgressBar value={progress} className="flex-1" />
          <span className="text-xs font-semibold text-slate-600 w-10 text-right">{progress}%</span>
          <span className="text-xs text-slate-400">{project.completed_task_count}/{project.task_count} tasks</span>
          {project.target_date && <span className="text-xs text-slate-400">· Due {formatDate(project.target_date)}</span>}
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-end gap-1 mt-5 overflow-x-auto">
          {([
            { key: 'board', label: 'Board', icon: <Kanban size={14} /> },
            { key: 'list', label: 'List', icon: <List size={14} /> },
            { key: 'calendar', label: 'Calendar', icon: <CalendarIcon size={14} /> },
            { key: 'timeline', label: 'Timeline', icon: <Layers size={14} /> },
            { key: 'gantt', label: 'Gantt', icon: <GanttChart size={14} /> },
            { key: 'milestones', label: 'Milestones', icon: <Diamond size={14} /> },
            { key: 'overview', label: 'Overview', icon: <CheckCircle2 size={14} /> },
          ] as const).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={[
                'flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-t-lg cursor-pointer select-none transition-all flex-shrink-0',
                'border-b-2 relative',
                tab === t.key
                  ? 'border-violet-500 text-violet-700 bg-violet-50/60'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100 hover:border-slate-300',
              ].join(' ')}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content — fills remaining height */}
      <div className="flex-1 overflow-auto" style={{ minHeight: 0 }}>
        {tasksLoading ? (
          <div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div>
        ) : tab === 'board' ? (
          <KanbanBoard tasks={tasks} onSelectTask={setSelectedTask} projectId={projectId} onAddTask={handleAddTask} />
        ) : tab === 'list' ? (
          tasks.length === 0 ? (
            <div className="px-8 py-6">
              <EmptyState
                icon={<List size={22} />}
                title="No tasks yet"
                description="Add your first task to this project."
                action={<Button variant="primary" size="sm" onClick={() => handleAddTask('not_started')}><Plus size={14} />Add Task</Button>}
              />
            </div>
          ) : (
            <div className="px-8 py-6">
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Task</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Priority</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Assignee</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Due Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map(t => <ListViewRow key={t.id} task={t} onSelect={() => setSelectedTask(t)} />)}
                  </tbody>
                </table>
              </div>
            </div>
          )
        ) : tab === 'calendar' ? (
          <ProjectCalendarView projectId={projectId} onSelectTask={setSelectedTask} onAddTaskOnDate={(d) => handleAddTask('not_started', d)} />
        ) : tab === 'timeline' ? (
          <ProjectTimelineView projectId={projectId} onSelectTask={setSelectedTask} />
        ) : tab === 'gantt' ? (
          <ProjectGanttView projectId={projectId} onSelectTask={setSelectedTask} />
        ) : tab === 'milestones' ? (
          <ProjectMilestonesView projectId={projectId} />
        ) : (
          /* Overview tab */
          <div className="px-8 py-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 max-w-4xl">
              <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-4">Task Summary</h3>
                <div className="space-y-3">
                  {Object.entries(TASK_STATUS_CONFIG).map(([status, cfg]) => {
                    const count = tasks.filter(t => t.status === status).length;
                    return (
                      <div key={status} className="flex items-center gap-3">
                        <span className={`text-xs font-medium w-24 ${cfg.color}`}>{cfg.label}</span>
                        <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                          <div
                            className="h-1.5 rounded-full bg-violet-500 transition-all"
                            style={{ width: tasks.length ? `${(count / tasks.length) * 100}%` : '0%' }}
                          />
                        </div>
                        <span className="text-xs text-slate-500 w-5 text-right">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-4">Project Info</h3>
                <div className="space-y-3 text-sm">
                  {[
                    { label: 'Work Mode', value: project.work_mode.replace('_', ' + ') },
                    { label: 'Start Date', value: formatDate(project.start_date) },
                    { label: 'Target Date', value: formatDate(project.target_date) },
                    { label: 'Total Tasks', value: String(project.task_count) },
                  ].map(row => (
                    <div key={row.label} className="flex justify-between border-b border-slate-50 pb-2">
                      <span className="text-slate-400">{row.label}</span>
                      <span className="font-medium text-slate-700 capitalize">{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Task detail drawer */}
      <TaskDetailDrawer task={selectedTask} onClose={() => setSelectedTask(null)} />

      {/* Create task modal */}
      <CreateTaskModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        projectId={projectId}
        defaultStatus={defaultStatus}
        defaultDate={createDate}
      />
      
      {/* Edit project modal */}
      <EditProjectModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        project={project}
      />
    </div>
  );
}

