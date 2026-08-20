import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectApi, orgApi } from '../../services/api';
import type { Project, ProjectWorkMode, Priority } from '../../types';
import { Button, Modal, Input, Textarea, Select } from '../../components/ui';
import { List, Milestone, Zap, Layers } from 'lucide-react';

const WORK_MODES: { value: ProjectWorkMode; label: string; desc: string; icon: React.ReactNode }[] = [
  { value: 'standard', label: 'Standard', desc: 'Simple task list. Best for small projects.', icon: <List size={20} /> },
  { value: 'milestone', label: 'Milestone', desc: 'Organize tasks around milestones.', icon: <Milestone size={20} /> },
  { value: 'sprint', label: 'Sprint', desc: 'Agile sprints for iterative delivery.', icon: <Zap size={20} /> },
  { value: 'milestone_sprint', label: 'Milestone + Sprint', desc: 'Full agile with milestone tracking.', icon: <Layers size={20} /> },
];

export default function EditProjectModal({ open, onClose, project }: { open: boolean; onClose: () => void; project: Project | null }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: '', description: '', priority: 'medium' as Priority,
    start_date: '', target_date: '', work_mode: 'standard' as ProjectWorkMode,
    manager_id: '' as string | number,
  });

  useEffect(() => {
    if (project) {
      setForm({
        name: project.name || '',
        description: project.description || '',
        priority: project.priority || 'medium',
        start_date: project.start_date ? project.start_date.split('T')[0] : '',
        target_date: project.target_date ? project.target_date.split('T')[0] : '',
        work_mode: project.work_mode || 'standard',
        manager_id: project.manager_id || '',
      });
    }
  }, [project]);

  const { data: employees = [] } = useQuery({
    queryKey: ['employees', project?.organization_id],
    queryFn: async () => (await orgApi.employees(project!.organization_id)).data,
    enabled: !!project?.organization_id && open,
  });

  const eligibleLeads = (employees as any[]);

  const mutation = useMutation({
    mutationFn: () => projectApi.update(project!.id, {
      ...form,
      manager_id: form.manager_id ? Number(form.manager_id) : null
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['project', project?.id] });
      onClose();
    },
  });

  const update = (k: string, v: string | number) => setForm(f => ({ ...f, [k]: v }));

  if (!project) return null;

  return (
    <Modal open={open} onClose={onClose} title="Edit Project">
      <div className="px-6 py-5 space-y-4 max-h-[80vh] overflow-y-auto">
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
        
        <div className="pt-2">
          <p className="text-sm font-semibold text-slate-700 mb-3">Work Mode</p>
          <div className="grid grid-cols-2 gap-3">
            {WORK_MODES.map(mode => (
              <button
                key={mode.value}
                onClick={() => update('work_mode', mode.value)}
                className={`p-3 rounded-xl border-2 text-left transition-all ${form.work_mode === mode.value
                  ? 'border-violet-500 bg-violet-50'
                  : 'border-slate-200 hover:border-slate-300 bg-white'}`}
              >
                <div className={`mb-1 ${form.work_mode === mode.value ? 'text-violet-600' : 'text-slate-400'}`}>{mode.icon}</div>
                <p className="text-xs font-semibold text-slate-700">{mode.label}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={mutation.isPending} onClick={() => mutation.mutate()} disabled={!form.name.trim()}>
            Save Changes
          </Button>
        </div>
      </div>
    </Modal>
  );
}
