import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { peopleApi } from '../../services/api';
import type { Employee } from '../../types';
import { Avatar, Spinner, Button, Modal } from '../../components/ui';
import { cn } from '../../utils';
import { useAuthStore } from '../../stores/authStore';
import {
  ArrowLeft, Mail, MessageSquare, Plus, MoreHorizontal,
  Shield, AlertTriangle, UserX, RefreshCw, ChevronDown,
  Building2, Edit
} from 'lucide-react';

import OverviewTab   from './tabs/OverviewTab';
import WorkTab       from './tabs/WorkTab';
import ProjectsTab   from './tabs/ProjectsTab';
import TeamsTab      from './tabs/TeamsTab';
import ActivityTab   from './tabs/ActivityTab';
import EditEmployeeModal from './EditEmployeeModal';

// ── Status badge ───────────────────────────────────────────
const STATUS_CFG: Record<string, { dot: string; badge: string; label: string }> = {
  active:     { dot: 'bg-emerald-500', badge: 'text-emerald-700 bg-emerald-50 border border-emerald-200', label: 'Active' },
  on_leave:   { dot: 'bg-amber-500',   badge: 'text-amber-700 bg-amber-50 border border-amber-200',       label: 'On Leave' },
  terminated: { dot: 'bg-red-500',     badge: 'text-red-700 bg-red-50 border border-red-200',             label: 'Deactivated' },
  invited:    { dot: 'bg-blue-500',    badge: 'text-blue-700 bg-blue-50 border border-blue-200',           label: 'Invited' },
};

const TABS = [
  { id: 'overview',  label: 'Overview'  },
  { id: 'work',      label: 'Work'      },
  { id: 'projects',  label: 'Projects'  },
  { id: 'teams',     label: 'Teams'     },
  { id: 'activity',  label: 'Activity'  },
];

// ── Confirm modal ──────────────────────────────────────────
function ConfirmModal({
  open, onClose, title, description, confirmLabel, confirmVariant, onConfirm, loading,
}: {
  open: boolean; onClose: () => void; title: string; description: string;
  confirmLabel: string; confirmVariant?: 'primary' | 'danger'; onConfirm: () => void; loading?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div className="p-6">
        <p className="text-sm text-slate-600 mb-6">{description}</p>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant={confirmVariant ?? 'danger'} loading={loading} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Main Page ──────────────────────────────────────────────
export default function EmployeeProfilePage() {
  const { id } = useParams<{ id: string }>();
  const empId = Number(id);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('overview');
  const [moreOpen, setMoreOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'suspend' | 'activate' | 'deactivate' | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);

  const isManager = ['admin', 'super_admin', 'manager'].includes(user?.role || '');
  const isAdmin   = ['admin', 'super_admin'].includes(user?.role || '');

  const { data: emp, isLoading, isError } = useQuery<Employee>({
    queryKey: ['employee', empId],
    queryFn: async () => { const r = await peopleApi.get(empId); return r.data; },
    enabled: !!empId,
  });

  const { data: directReports = [] } = useQuery<Employee[]>({
    queryKey: ['emp-reports', empId],
    queryFn: async () => { const r = await peopleApi.directReports(empId); return Array.isArray(r.data) ? r.data : []; },
    enabled: !!empId,
  });

  const { data: activity = [] } = useQuery<any[]>({
    queryKey: ['emp-activity-ov', empId],
    queryFn: async () => { const r = await peopleApi.activity(empId, 10); return Array.isArray(r.data) ? r.data : []; },
    enabled: !!empId,
  });

  const statusMutation = useMutation({
    mutationFn: async (action: 'suspend' | 'activate' | 'deactivate') => {
      if (action === 'suspend') await peopleApi.suspend(empId);
      else if (action === 'activate') await peopleApi.activate(empId);
      else await peopleApi.deactivate(empId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employee', empId] });
      qc.invalidateQueries({ queryKey: ['employees'] });
      setConfirmAction(null);
    },
  });

  const editMutation = useMutation({
    mutationFn: async (data: any) => await peopleApi.update(empId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employee', empId] });
      qc.invalidateQueries({ queryKey: ['employees'] });
      setEditModalOpen(false);
    }
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Spinner className="w-10 h-10 mx-auto mb-4" />
          <p className="text-sm text-slate-500">Loading profile…</p>
        </div>
      </div>
    );
  }

  if (isError || !emp) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <AlertTriangle size={32} className="text-red-400" />
        <p className="text-slate-700 font-semibold">Employee could not be loaded.</p>
        <Button variant="secondary" onClick={() => navigate('/people')}>Back to People</Button>
      </div>
    );
  }

  const st = STATUS_CFG[emp.status] || STATUS_CFG['active'];

  const CONFIRM_CFG = {
    suspend: {
      title: `Suspend ${emp.full_name}?`,
      description: 'They will no longer be able to sign in. You can reactivate them at any time.',
      confirmLabel: 'Suspend',
      confirmVariant: 'danger' as const,
    },
    activate: {
      title: `Reactivate ${emp.full_name}?`,
      description: 'This will restore their access to the organization.',
      confirmLabel: 'Reactivate',
      confirmVariant: 'primary' as const,
    },
    deactivate: {
      title: `Deactivate ${emp.full_name}?`,
      description: 'This will permanently deactivate their account. Historical data will be preserved. This action should be used when an employee leaves the organization.',
      confirmLabel: 'Deactivate',
      confirmVariant: 'danger' as const,
    },
  };

  return (
    <div className="w-full min-h-full">
      {/* ── Profile Header ─────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-8 pt-6 pb-0">
        {/* Back + actions row */}
        <div className="flex items-center justify-between mb-5">
          <button
            onClick={() => navigate('/people')}
            className="group flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
            People
          </button>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm">
              <Mail size={14} /> Email
            </Button>
            <Button variant="secondary" size="sm">
              <MessageSquare size={14} /> Message
            </Button>
            <Button variant="primary" size="sm">
              <Plus size={14} /> Assign Task
            </Button>
            {isManager && (
              <div className="relative">
                <Button
                  variant="secondary" size="sm"
                  onClick={() => setMoreOpen(o => !o)}
                  id="emp-more-btn"
                >
                  <MoreHorizontal size={14} /> More <ChevronDown size={12} />
                </Button>
                {moreOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setMoreOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-lg z-40 py-1 overflow-hidden">
                      {isManager && (
                        <button
                          className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                          onClick={() => { setMoreOpen(false); setEditModalOpen(true); }}
                        >
                          <Edit size={14} /> Edit Employee
                        </button>
                      )}
                      {emp.status !== 'active' && (
                        <button
                          className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-emerald-700 hover:bg-emerald-50 transition-colors"
                          onClick={() => { setMoreOpen(false); setConfirmAction('activate'); }}
                        >
                          <RefreshCw size={14} /> Reactivate
                        </button>
                      )}
                      {emp.status === 'active' && isManager && (
                        <button
                          className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-amber-700 hover:bg-amber-50 transition-colors"
                          onClick={() => { setMoreOpen(false); setConfirmAction('suspend'); }}
                        >
                          <Shield size={14} /> Suspend
                        </button>
                      )}
                      {isAdmin && (
                        <button
                          className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-red-700 hover:bg-red-50 transition-colors"
                          onClick={() => { setMoreOpen(false); setConfirmAction('deactivate'); }}
                        >
                          <UserX size={14} /> Deactivate
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Profile identity */}
        <div className="flex items-end gap-5 mb-6">
          <div className="relative">
            <Avatar name={emp.full_name} src={emp.avatar_url} size="lg"
              className="!w-20 !h-20 text-2xl ring-4 ring-white shadow-md" />
            <span className={cn('absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white', st.dot)} />
          </div>

          <div className="flex-1 pb-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-900">{emp.full_name}</h1>
              <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium', st.badge)}>
                <span className={cn('w-1.5 h-1.5 rounded-full', st.dot)} />{st.label}
              </span>
            </div>
            <p className="text-slate-500 mt-0.5">{emp.designation || 'No designation'}</p>
            <div className="flex items-center gap-2 mt-1 text-sm text-slate-400 flex-wrap">
              <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700">
                <Building2 size={12} className="text-slate-500" />
                <span>{emp.department_name || 'Not Assigned'}</span>
              </div>
              {emp.teams && emp.teams.length > 0 && (
                <>
                  <span className="text-slate-300">·</span>
                  {emp.teams.slice(0, 2).map(t => (
                    <span key={t.id}>{t.name}</span>
                  ))}
                </>
              )}
              {emp.manager_name && (
                <>
                  <span className="text-slate-300">·</span>
                  <span>Reports to <button
                    onClick={() => emp.manager_id && navigate(`/people/${emp.manager_id}`)}
                    className="text-violet-600 hover:underline"
                  >{emp.manager_name}</button></span>
                </>
              )}
            </div>
          </div>

          {/* Quick stats */}
          <div className="flex items-center gap-4 pb-2 flex-shrink-0">
            {[
              { label: 'Projects', value: emp.active_projects_count ?? 0 },
              { label: 'Tasks', value: emp.active_tasks_count ?? 0 },
              { label: 'Workload', value: `${emp.workload_percentage ?? 0}%` },
            ].map(s => (
              <div key={s.label} className="text-center">
                <p className="text-xl font-bold text-slate-800">{s.value}</p>
                <p className="text-xs text-slate-400">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-0 -mb-px">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-5 py-3 text-sm font-medium border-b-2 transition-all',
                activeTab === tab.id
                  ? 'border-violet-600 text-violet-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ─────────────────────────────────── */}
      <div className="px-8 py-6">
        {activeTab === 'overview' && (
          <OverviewTab emp={emp} directReports={directReports} activity={activity} />
        )}
        {activeTab === 'work' && <WorkTab empId={empId} />}
        {activeTab === 'projects' && <ProjectsTab empId={empId} />}
        {activeTab === 'teams' && <TeamsTab empId={empId} />}
        {activeTab === 'activity' && <ActivityTab empId={empId} />}
      </div>

      {/* ── Confirm modals ────────────────────────────── */}
      {confirmAction && (
        <ConfirmModal
          open={true}
          onClose={() => setConfirmAction(null)}
          title={CONFIRM_CFG[confirmAction].title}
          description={CONFIRM_CFG[confirmAction].description}
          confirmLabel={CONFIRM_CFG[confirmAction].confirmLabel}
          confirmVariant={CONFIRM_CFG[confirmAction].confirmVariant}
          onConfirm={() => statusMutation.mutate(confirmAction)}
          loading={statusMutation.isPending}
        />
      )}

      {editModalOpen && (
        <EditEmployeeModal
          open={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          employee={emp}
          onSubmit={async (data) => editMutation.mutateAsync(data)}
          isSubmitting={editMutation.isPending}
        />
      )}
    </div>
  );
}
