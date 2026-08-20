import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { projectApi, orgApi } from '../../services/api';
import type { Project, ProjectWorkMode, Priority } from '../../types';
import {
  Button, Badge, ProgressBar, Spinner, EmptyState, Modal, Input, Textarea, Select,
  PageShell, PageHeader,
} from '../../components/ui';
import { PROJECT_STATUS_CONFIG, PRIORITY_CONFIG, getProjectProgress, formatDate } from '../../utils';
import { Plus, Briefcase, List, LayoutGrid, Search, Layers, Milestone, Zap, Edit } from 'lucide-react';
import EditProjectModal from './EditProjectModal';

const WORK_MODES: { value: ProjectWorkMode; label: string; desc: string; icon: React.ReactNode }[] = [
  { value: 'standard', label: 'Standard', desc: 'Simple task list. Best for small projects.', icon: <List size={20} /> },
  { value: 'milestone', label: 'Milestone', desc: 'Organize tasks around milestones.', icon: <Milestone size={20} /> },
  { value: 'sprint', label: 'Sprint', desc: 'Agile sprints for iterative delivery.', icon: <Zap size={20} /> },
  { value: 'milestone_sprint', label: 'Milestone + Sprint', desc: 'Full agile with milestone tracking.', icon: <Layers size={20} /> },
];

function CreateProjectModal({ open, onClose, orgId }: { open: boolean; onClose: () => void; orgId: number }) {
  const qc = useQueryClient();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: '', description: '', priority: 'medium' as Priority,
    start_date: '', target_date: '', work_mode: 'standard' as ProjectWorkMode,
    manager_id: '' as string | number,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees', orgId],
    queryFn: async () => (await orgApi.employees(orgId)).data,
    enabled: !!orgId && open,
  });

  const eligibleLeads = (employees as any[]);

  const mutation = useMutation({
    mutationFn: () => projectApi.create({ ...form, organization_id: orgId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      onClose();
      setStep(1);
      setForm({ name: '', description: '', priority: 'medium', start_date: '', target_date: '', work_mode: 'standard', manager_id: '' });
    },
  });

  const update = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <Modal open={open} onClose={onClose} title="Create new project" size="lg">
      {/* Step indicator */}
      <div className="px-6 pt-5 pb-0">
        <div className="flex items-center gap-2 mb-6">
          {['Info', 'Work Mode', 'Review'].map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold
                ${step > i + 1 ? 'bg-violet-600 text-white' : step === i + 1 ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                {i + 1}
              </div>
              <span className={`text-xs font-medium ${step === i + 1 ? 'text-violet-700' : 'text-slate-400'}`}>{s}</span>
              {i < 2 && <div className="w-8 h-px bg-slate-200" />}
            </div>
          ))}
        </div>
      </div>

      <div className="px-6 pb-6">
        {step === 1 && (
          <div className="space-y-4">
            <Input id="proj-name" label="Project name *" placeholder="e.g. Website Redesign" value={form.name} onChange={e => update('name', e.target.value)} />
            <Textarea id="proj-desc" label="Description" placeholder="What is this project about?" rows={3} value={form.description} onChange={e => update('description', e.target.value)} />
            <div className="grid grid-cols-2 gap-4">
              <Input id="start" label="Start date" type="date" value={form.start_date} onChange={e => update('start_date', e.target.value)} />
              <Input id="target" label="Target date" type="date" value={form.target_date} onChange={e => update('target_date', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Select id="priority" label="Priority" value={form.priority} onChange={e => update('priority', e.target.value)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </Select>
              
              <Select id="manager" label="Team Lead / Manager" value={form.manager_id} onChange={e => update('manager_id', e.target.value ? Number(e.target.value) : '')}>
                <option value="">Unassigned</option>
                {eligibleLeads.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.full_name || (emp.user && emp.user.full_name) || 'Unknown'} {emp.user?.role ? `(${emp.user.role.replace('_', ' ')})` : ''}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <p className="text-sm text-slate-500 mb-4">How do you want to organize work in this project?</p>
            <div className="grid grid-cols-2 gap-3">
              {WORK_MODES.map(mode => (
                <button
                  key={mode.value}
                  onClick={() => update('work_mode', mode.value)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${form.work_mode === mode.value
                    ? 'border-violet-500 bg-violet-50'
                    : 'border-slate-200 hover:border-slate-300 bg-white'}`}
                >
                  <div className={`mb-2 ${form.work_mode === mode.value ? 'text-violet-600' : 'text-slate-400'}`}>{mode.icon}</div>
                  <p className="text-sm font-semibold text-slate-700">{mode.label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{mode.desc}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <p className="text-sm text-slate-500 mb-4">Review before creating.</p>
            {[
              { label: 'Name', value: form.name },
              { label: 'Priority', value: form.priority },
              { label: 'Team Lead', value: eligibleLeads.find(e => e.id === form.manager_id)?.full_name || 'Unassigned' },
              { label: 'Work Mode', value: WORK_MODES.find(m => m.value === form.work_mode)?.label },
              { label: 'Start', value: form.start_date || '—' },
              { label: 'Target', value: form.target_date || '—' },
            ].map(row => (
              <div key={row.label} className="flex justify-between py-2 border-b border-slate-100 text-sm">
                <span className="text-slate-500">{row.label}</span>
                <span className="font-medium text-slate-700 capitalize">{row.value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-between mt-6 pt-4 border-t border-slate-100">
          <Button variant="ghost" onClick={step === 1 ? onClose : () => setStep(s => s - 1)}>
            {step === 1 ? 'Cancel' : 'Back'}
          </Button>
          {step < 3 ? (
            <Button variant="primary" onClick={() => setStep(s => s + 1)} disabled={step === 1 && !form.name.trim()}>
              Continue
            </Button>
          ) : (
            <Button variant="primary" loading={mutation.isPending} onClick={() => mutation.mutate()}>
              Create Project
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

function ProjectCard({ project, onClick, onEdit }: { project: Project; onClick: () => void; onEdit?: (e: React.MouseEvent) => void }) {
  const progress = getProjectProgress(project.task_count, project.completed_task_count);
  const sc = PROJECT_STATUS_CONFIG[project.status];
  const pc = PRIORITY_CONFIG[project.priority];

  return (
    <div
      onClick={onClick}
      className="bg-white border border-slate-200 rounded-xl p-5 cursor-pointer hover:shadow-md hover:border-violet-200 transition-all group relative"
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-semibold text-slate-800 text-sm group-hover:text-violet-700 transition-colors leading-tight pr-2">{project.name}</h3>
        <div className="flex items-center gap-2">
          {onEdit && (
            <button 
              onClick={onEdit} 
              className="text-slate-300 hover:text-violet-600 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Edit Project"
            >
              <Edit size={14} />
            </button>
          )}
          <Badge className={pc.color}>{pc.label}</Badge>
        </div>
      </div>
      {project.description && (
        <p className="text-xs text-slate-400 mb-3 line-clamp-2">{project.description}</p>
      )}
      <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
        <Badge className={sc.color}>{sc.label}</Badge>
        <span>{project.task_count} tasks</span>
      </div>
      <ProgressBar value={progress} />
      <div className="flex justify-between text-xs text-slate-400 mt-1.5">
        <span>{progress}% complete</span>
        {project.target_date && <span>Due {formatDate(project.target_date)}</span>}
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  const { orgId } = useAuthStore();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [createOpen, setCreateOpen] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);

  const { data: rawProjects, isLoading } = useQuery<Project[]>({
    queryKey: ['projects', orgId],
    queryFn: async () => {
      const res = await projectApi.list(orgId!);
      return Array.isArray(res.data) ? res.data : [];
    },
    enabled: !!orgId,
  });

  const projects = Array.isArray(rawProjects) ? rawProjects : [];
  const filtered = projects.filter(p => p.name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <PageShell>
      <PageHeader
        title="Projects"
        subtitle={`${projects.length} project${projects.length !== 1 ? 's' : ''} in your workspace`}
        action={
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <Plus size={16} />
            New Project
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 flex-1 max-w-xs">
          <Search size={15} className="text-slate-400" />
          <input
            type="text"
            placeholder="Search projects..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="text-sm text-slate-700 placeholder:text-slate-400 bg-transparent outline-none flex-1"
          />
        </div>
        <div className="flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden">
          <button onClick={() => setViewMode('grid')} className={`p-2 transition-colors ${viewMode === 'grid' ? 'bg-violet-50 text-violet-600' : 'text-slate-400 hover:text-slate-600'}`}>
            <LayoutGrid size={16} />
          </button>
          <button onClick={() => setViewMode('list')} className={`p-2 transition-colors ${viewMode === 'list' ? 'bg-violet-50 text-violet-600' : 'text-slate-400 hover:text-slate-600'}`}>
            <List size={16} />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Spinner className="w-8 h-8" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Briefcase size={24} />}
          title="No projects yet"
          description="Create your first project to start organizing your team's work."
          action={<Button variant="primary" onClick={() => setCreateOpen(true)}><Plus size={15} />Create Project</Button>}
        />
      ) : (
        <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4' : 'space-y-3'}>
          {filtered.map(p => (
            <ProjectCard 
              key={p.id} 
              project={p} 
              onClick={() => navigate(`/projects/${p.id}`)} 
              onEdit={(e) => {
                e.stopPropagation();
                setEditProject(p);
              }}
            />
          ))}
        </div>
      )}

      {orgId && <CreateProjectModal open={createOpen} onClose={() => setCreateOpen(false)} orgId={orgId} />}
      <EditProjectModal open={!!editProject} onClose={() => setEditProject(null)} project={editProject} />
    </PageShell>
  );
}
