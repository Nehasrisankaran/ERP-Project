import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectApi, orgApi } from '../../services/api';
import type { Milestone, MilestoneStatus } from '../../types';
import { Button, ProgressBar, Spinner, Modal, Input, Textarea, Select } from '../../components/ui';
import { formatDate } from '../../utils';
import { Diamond, Plus, Trash2, User } from 'lucide-react';

interface ProjectMilestonesViewProps {
  projectId: number;
}

const MILESTONE_STATUS_CONFIG: Record<MilestoneStatus, { label: string; bg: string; text: string }> = {
  upcoming: { label: 'Upcoming', bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700' },
  in_progress: { label: 'In Progress', bg: 'bg-violet-50 border-violet-200', text: 'text-violet-700' },
  completed: { label: 'Completed', bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700' },
  delayed: { label: 'Delayed', bg: 'bg-rose-50 border-rose-200', text: 'text-rose-700' },
};

export default function ProjectMilestonesView({ projectId }: ProjectMilestonesViewProps) {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);


  const [form, setForm] = useState({
    name: '', description: '', target_date: '', owner_id: '',
  });

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => { const r = await projectApi.get(projectId); return r.data; },
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees', project?.organization_id],
    queryFn: async () => { const r = await orgApi.employees(project.organization_id); return r.data; },
    enabled: !!project?.organization_id,
  });

  const { data: milestones = [], isLoading } = useQuery<Milestone[]>({
    queryKey: ['milestones', projectId],
    queryFn: async () => {
      const r = await projectApi.getMilestones(projectId);
      return Array.isArray(r.data) ? r.data : [];
    },
    enabled: !!projectId,
  });

  const createMutation = useMutation({
    mutationFn: () => projectApi.createMilestone(projectId, {
      ...form,
      owner_id: form.owner_id ? Number(form.owner_id) : null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['milestones', projectId] });
      setCreateOpen(false);
      setForm({ name: '', description: '', target_date: '', owner_id: '' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => projectApi.deleteMilestone(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['milestones', projectId] }),
  });

  if (isLoading) {
    return <div className="flex justify-center py-20"><Spinner className="w-8 h-8 text-violet-600" /></div>;
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Diamond className="text-amber-500 fill-current" size={20} />
            Project Milestones & Key Checkpoints
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">Track significant deliverable targets and monitor task completion progress</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
          <Plus size={14} /> Add Milestone
        </Button>
      </div>

      {/* Milestones Cards Grid */}
      {milestones.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-3">
          <Diamond className="mx-auto text-slate-300" size={32} />
          <h3 className="text-base font-bold text-slate-700">No Milestones Defined</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">Create milestones to define key project goals like "Backend Architecture Complete" or "Beta Launch".</p>
          <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus size={14} /> Create First Milestone
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {milestones.map(m => {
            const statusCfg = MILESTONE_STATUS_CONFIG[m.status] || MILESTONE_STATUS_CONFIG.upcoming;
            return (
              <div key={m.id} className="bg-white border border-slate-200 hover:border-amber-400 rounded-2xl p-5 shadow-sm transition-all space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 flex-shrink-0 mt-0.5">
                      <Diamond size={20} className="fill-current" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusCfg.bg} ${statusCfg.text}`}>
                          {statusCfg.label}
                        </span>
                        <span className="text-xs text-slate-400 font-medium">Target: {formatDate(m.target_date)}</span>
                      </div>
                      <h3 className="text-base font-bold text-slate-900 mt-1">{m.name}</h3>
                      {m.description && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{m.description}</p>}
                    </div>
                  </div>

                  <button
                    onClick={() => deleteMutation.mutate(m.id)}
                    className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors"
                    title="Delete milestone"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">Linked Tasks Progress</span>
                    <span className="font-bold text-violet-700">{m.completed_tasks_count}/{m.total_tasks_count} tasks ({m.progress_percentage}%)</span>
                  </div>
                  <ProgressBar value={m.progress_percentage} className="h-2" />
                </div>

                {/* Owner info */}
                {m.owner_name && (
                  <div className="flex items-center gap-2 text-xs text-slate-500 pt-1">
                    <User size={12} className="text-slate-400" />
                    <span>Owner: <strong className="text-slate-700">{m.owner_name}</strong></span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Milestone Modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create New Milestone">
        <div className="px-6 py-5 space-y-4">
          <Input id="m-name" label="Milestone Name *" placeholder="e.g. Beta Release Launch" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
          <Textarea id="m-desc" label="Description" placeholder="Scope and checkpoints for this milestone..." rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          <div className="grid grid-cols-2 gap-4">
            <Input id="m-date" label="Target Date *" type="date" value={form.target_date} onChange={e => setForm(f => ({ ...f, target_date: e.target.value }))} />
            <Select id="m-owner" label="Milestone Owner" value={form.owner_id} onChange={e => setForm(f => ({ ...f, owner_id: e.target.value }))}>
              <option value="">Unassigned</option>
              {employees.map((emp: any) => (
                <option key={emp.id} value={emp.id}>{emp.full_name}</option>
              ))}
            </Select>
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={createMutation.isPending} onClick={() => createMutation.mutate()} disabled={!form.name.trim() || !form.target_date}>
              Create Milestone
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
