import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { peopleApi } from '../../../services/api';
import type { Project } from '../../../types';
import { Spinner, ProgressBar } from '../../../components/ui';
import { cn } from '../../../utils';
import { ExternalLink, Calendar, Briefcase } from 'lucide-react';

const STATUS_CFG: Record<string, { badge: string; label: string }> = {
  planning:  { badge: 'text-slate-600 bg-slate-100',     label: 'Planning'   },
  active:    { badge: 'text-emerald-700 bg-emerald-50',  label: 'Active'     },
  on_hold:   { badge: 'text-amber-700 bg-amber-50',      label: 'On Hold'    },
  completed: { badge: 'text-blue-700 bg-blue-50',        label: 'Completed'  },
  cancelled: { badge: 'text-red-700 bg-red-50',          label: 'Cancelled'  },
};

function ProjectCard({ project }: { project: Project }) {
  const navigate = useNavigate();
  const st = STATUS_CFG[project.status] || STATUS_CFG.planning;
  const pct = project.task_count ? Math.round((project.completed_task_count / project.task_count) * 100) : 0;

  return (
    <div
      onClick={() => navigate(`/projects/${project.id}`)}
      className="bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-md hover:border-violet-300 cursor-pointer group transition-all"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center">
            <Briefcase size={16} className="text-violet-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800 group-hover:text-violet-700 transition-colors">{project.name}</p>
          </div>
        </div>
        <span className={cn('text-[11px] font-medium px-2.5 py-1 rounded-full', st.badge)}>{st.label}</span>
      </div>

      {project.description && (
        <p className="text-xs text-slate-500 mb-4 line-clamp-2">{project.description}</p>
      )}

      {/* Progress */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-slate-500 mb-1.5">
          <span>Progress</span>
          <span className="font-semibold">{pct}%</span>
        </div>
        <ProgressBar value={pct} />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-slate-100">
        <span>{project.completed_task_count}/{project.task_count} tasks</span>
        {project.target_date && (
          <span className="flex items-center gap-1">
            <Calendar size={11} />
            {new Date(project.target_date + 'T00:00:00').toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}
          </span>
        )}
        <ExternalLink size={12} className="text-slate-300 group-hover:text-violet-500 transition-colors" />
      </div>
    </div>
  );
}

export default function ProjectsTab({ empId }: { empId: number }) {
  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ['emp-projects', empId],
    queryFn: async () => { const r = await peopleApi.projects(empId); return Array.isArray(r.data) ? r.data : []; },
  });

  if (isLoading) return <div className="flex justify-center py-12"><Spinner className="w-8 h-8" /></div>;

  const active = projects.filter(p => p.status === 'active');
  const other = projects.filter(p => p.status !== 'active');

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
          <Briefcase size={22} className="text-slate-400" />
        </div>
        <p className="text-sm font-semibold text-slate-700">No projects assigned</p>
        <p className="text-xs text-slate-400 mt-1">This employee isn't a member of any project yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {active.length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Active Projects</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {active.map(p => <ProjectCard key={p.id} project={p} />)}
          </div>
        </div>
      )}
      {other.length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Other Projects</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {other.map(p => <ProjectCard key={p.id} project={p} />)}
          </div>
        </div>
      )}
    </div>
  );
}
