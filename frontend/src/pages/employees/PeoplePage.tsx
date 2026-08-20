import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { orgApi } from '../../services/api';
import {
  Avatar, Spinner, EmptyState, Button
} from '../../components/ui';

import type { Employee, Department } from '../../types';
import {
  Users, UserPlus, Search, LayoutGrid, LayoutList,
  MapPin, CheckCircle2, Clock, AlertTriangle,
  Building2, UsersRound, Eye
} from 'lucide-react';
import { cn } from '../../utils';

// ── Status helpers ─────────────────────────────────────────
const STATUS_CONFIG: Record<string, { dot: string; badge: string; label: string }> = {
  active:     { dot: 'bg-emerald-500', badge: 'text-emerald-700 bg-emerald-50 border border-emerald-200', label: 'Active' },
  on_leave:   { dot: 'bg-amber-500',   badge: 'text-amber-700 bg-amber-50 border border-amber-200',     label: 'On Leave' },
  terminated: { dot: 'bg-red-500',     badge: 'text-red-700 bg-red-50 border border-red-200',           label: 'Deactivated' },
  invited:    { dot: 'bg-blue-500',    badge: 'text-blue-700 bg-blue-50 border border-blue-200',         label: 'Invited' },
  suspended:  { dot: 'bg-slate-500',   badge: 'text-slate-700 bg-slate-100 border border-slate-200',    label: 'Suspended' },
};

const WORKLOAD_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  Underutilized: { color: 'text-slate-500', bg: 'bg-slate-200', label: 'Underutilized' },
  Healthy:       { color: 'text-emerald-600', bg: 'bg-emerald-500', label: 'Healthy' },
  High:          { color: 'text-amber-600', bg: 'bg-amber-500', label: 'High' },
  Overloaded:    { color: 'text-red-600', bg: 'bg-red-500', label: 'Overloaded' },
};

// ── WorkloadBar ────────────────────────────────────────────
function WorkloadBar({ pct, status }: { pct: number; status: string }) {
  const cfg = WORKLOAD_CONFIG[status] || WORKLOAD_CONFIG['Healthy'];
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', cfg.bg)}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className={cn('text-xs font-semibold tabular-nums', cfg.color)}>{pct}%</span>
    </div>
  );
}

// ── Employee Table Row ─────────────────────────────────────
function TableRow({ emp, onView }: { emp: Employee; onView: (id: number) => void }) {
  const st = STATUS_CONFIG[emp.status] || STATUS_CONFIG['active'];
  const wl = WORKLOAD_CONFIG[emp.workload_status || 'Healthy'];

  return (
    <tr
      className="group border-b border-slate-100 hover:bg-violet-50/30 transition-colors cursor-pointer"
      onClick={() => onView(emp.id)}
    >
      {/* Avatar + Name */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar name={emp.full_name} src={emp.avatar_url} size="md" />
          <div>
            <p className="text-sm font-semibold text-slate-800 group-hover:text-violet-700 transition-colors">
              {emp.full_name || '—'}
            </p>
            <p className="text-xs text-slate-400">{emp.email || '—'}</p>
          </div>
        </div>
      </td>
      {/* Title */}
      <td className="px-4 py-3">
        <p className="text-sm text-slate-700">{emp.designation || '—'}</p>
      </td>
      {/* Department */}
      <td className="px-4 py-3">
        <p className="text-sm text-slate-600">{emp.department_name || 'Not Assigned'}</p>
      </td>
      {/* Teams */}
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {(emp.teams || []).slice(0, 2).map(t => (
            <span key={t.id} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{t.name}</span>
          ))}
          {(emp.teams || []).length > 2 && (
            <span className="text-xs text-slate-400">+{(emp.teams || []).length - 2}</span>
          )}
        </div>
      </td>
      {/* Status */}
      <td className="px-4 py-3">
        <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium', st.badge)}>
          <span className={cn('w-1.5 h-1.5 rounded-full', st.dot)} />
          {st.label}
        </span>
      </td>
      {/* Workload */}
      <td className="px-4 py-3 min-w-[120px]">
        <WorkloadBar pct={emp.workload_percentage || 0} status={emp.workload_status || 'Healthy'} />
        <p className={cn('text-xs mt-0.5', wl.color)}>{emp.workload_status}</p>
      </td>
      {/* Projects */}
      <td className="px-4 py-3 text-center">
        <span className="text-sm font-medium text-slate-700">{emp.active_projects_count ?? 0}</span>
      </td>
      {/* Tasks */}
      <td className="px-4 py-3 text-center">
        <span className="text-sm font-medium text-slate-700">{emp.active_tasks_count ?? 0}</span>
        {(emp.overdue_tasks_count ?? 0) > 0 && (
          <span className="ml-1 text-xs text-red-500 font-medium">({emp.overdue_tasks_count} overdue)</span>
        )}
      </td>
      {/* Actions */}
      <td className="px-4 py-3">
        <button
          onClick={e => { e.stopPropagation(); onView(emp.id); }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 hover:bg-violet-100 text-violet-700 text-xs font-medium rounded-lg transition-colors"
        >
          <Eye size={13} /> View
        </button>
      </td>
    </tr>
  );
}

// ── Employee Card ──────────────────────────────────────────
function EmployeeCard({ emp, onView }: { emp: Employee; onView: (id: number) => void }) {
  const st = STATUS_CONFIG[emp.status] || STATUS_CONFIG['active'];
  return (
    <div
      onClick={() => onView(emp.id)}
      className="bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-md hover:border-violet-300 transition-all cursor-pointer group"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <Avatar name={emp.full_name} src={emp.avatar_url} size="lg" />
          <div>
            <p className="font-semibold text-slate-800 group-hover:text-violet-700 transition-colors text-sm">
              {emp.full_name || '—'}
            </p>
            <p className="text-xs text-slate-500">{emp.designation || 'No designation'}</p>
          </div>
        </div>
        <span className={cn('inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium', st.badge)}>
          <span className={cn('w-1.5 h-1.5 rounded-full', st.dot)} />
          {st.label}
        </span>
      </div>

      {/* Meta */}
      <div className="space-y-1.5 mb-4">
        {emp.department_name && (
          <p className="text-xs text-slate-500 flex items-center gap-1.5">
            <Building2 size={11} className="text-slate-400" /> {emp.department_name}
          </p>
        )}
        {emp.location && (
          <p className="text-xs text-slate-500 flex items-center gap-1.5">
            <MapPin size={11} className="text-slate-400" /> {emp.location}
          </p>
        )}
        {(emp.teams || []).length > 0 && (
          <p className="text-xs text-slate-500 flex items-center gap-1.5">
            <UsersRound size={11} className="text-slate-400" />
            {emp.teams!.slice(0, 2).map(t => t.name).join(', ')}
          </p>
        )}
      </div>

      {/* Workload */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-slate-500">Workload</span>
          <span className="text-xs font-semibold text-slate-700">{emp.workload_percentage || 0}%</span>
        </div>
        <WorkloadBar pct={emp.workload_percentage || 0} status={emp.workload_status || 'Healthy'} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100">
        <div className="text-center">
          <p className="text-sm font-bold text-slate-800">{emp.active_projects_count ?? 0}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Projects</p>
        </div>
        <div className="text-center">
          <p className="text-sm font-bold text-slate-800">{emp.active_tasks_count ?? 0}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Tasks</p>
        </div>
        <div className="text-center">
          <p className={cn('text-sm font-bold', (emp.overdue_tasks_count ?? 0) > 0 ? 'text-red-600' : 'text-slate-800')}>
            {emp.overdue_tasks_count ?? 0}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">Overdue</p>
        </div>
      </div>
    </div>
  );
}

import AddEmployeeWizard from './AddEmployeeWizard';

// ── Add Employee Wizard Handler ─────────────────────────────
function AddEmployeeModalWrapper({
  open, onClose, departments, employees
}: {
  open: boolean; onClose: () => void;
  departments: Department[]; employees: Employee[];
}) {
  const { orgId } = useAuthStore();
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (wizardData: any) => {
      // Generate one-time activation password hash internally without exposing in UI
      const tempPass = `WmInit!${Math.random().toString(36).slice(-8)}`;

      // 1) Register User with specified WORKMATE role
      const userRes = await fetch('http://localhost:8000/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('access_token')}` },
        body: JSON.stringify({
          email: wizardData.work_email,
          full_name: wizardData.full_name,
          password: tempPass,
          role: wizardData.app_role || 'employee',
          organization_id: orgId
        }),
      });
      
      if (!userRes.ok) {
        const err = await userRes.json();
        throw new Error(err.detail || 'Failed to register account for employee');
      }

      const user = await userRes.json();

      // 2) Create Employee record tied to organization & hierarchy
      await orgApi.createEmployee({
        user_id: user.id,
        organization_id: orgId,
        department_id: wizardData.department_id ? Number(wizardData.department_id) : null,
        employee_code: wizardData.employee_code || null,
        designation: wizardData.designation || null,
        phone: wizardData.phone || null,
        location: wizardData.location || null,
        date_joined: wizardData.date_joined || null,
        reporting_manager_id: wizardData.reports_to_none ? null : (wizardData.reporting_manager_id ? Number(wizardData.reporting_manager_id) : null),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] });
      onClose();
    },
  });

  return (
    <AddEmployeeWizard
      open={open}
      onClose={onClose}
      departments={departments}
      employees={employees}
      isSubmitting={mutation.isPending}
      onSubmit={async (data) => {
        await mutation.mutateAsync(data);
      }}
    />
  );
}


// ── Main Page ──────────────────────────────────────────────
export default function PeoplePage() {
  const { orgId } = useAuthStore();
  const navigate = useNavigate();
  const [view, setView] = useState<'table' | 'card'>('table');
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterWorkload, setFilterWorkload] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'workload' | 'tasks' | 'joined'>('name');
  const [addOpen, setAddOpen] = useState(false);

  const { data: rawEmployees = [], isLoading } = useQuery<Employee[]>({
    queryKey: ['employees', orgId],
    queryFn: async () => { const r = await orgApi.employees(orgId!); return Array.isArray(r.data) ? r.data : []; },
    enabled: !!orgId,
  });
  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ['departments', orgId],
    queryFn: async () => { const r = await orgApi.departments(orgId!); return Array.isArray(r.data) ? r.data : []; },
    enabled: !!orgId,
  });


  const filtered = useMemo(() => {
    let list = [...rawEmployees];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(e =>
        e.full_name?.toLowerCase().includes(q) ||
        e.email?.toLowerCase().includes(q) ||
        e.designation?.toLowerCase().includes(q) ||
        e.department_name?.toLowerCase().includes(q) ||
        e.teams?.some(t => t.name.toLowerCase().includes(q))
      );
    }
    if (filterDept) list = list.filter(e => String(e.department_id) === filterDept);
    if (filterStatus) list = list.filter(e => e.status === filterStatus);
    if (filterWorkload) list = list.filter(e => e.workload_status === filterWorkload);
    list.sort((a, b) => {
      if (sortBy === 'workload') return (b.workload_percentage || 0) - (a.workload_percentage || 0);
      if (sortBy === 'tasks') return (b.active_tasks_count || 0) - (a.active_tasks_count || 0);
      if (sortBy === 'joined') return (b.date_joined || '').localeCompare(a.date_joined || '');
      return (a.full_name || '').localeCompare(b.full_name || '');
    });
    return list;
  }, [rawEmployees, search, filterDept, filterStatus, filterWorkload, sortBy]);

  const active = rawEmployees.filter(e => e.status === 'active').length;

  return (
    <div className="w-full px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">People</h1>
            <p className="text-sm text-slate-500 mt-1">Manage your organization and understand who's doing what.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setAddOpen(true)}>
              <UserPlus size={15} /> Invite Employee
            </Button>
            <Button variant="primary" onClick={() => setAddOpen(true)}>
              <UserPlus size={15} /> Add Employee
            </Button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-4 gap-4 mt-6">
          {[
            { label: 'Total Employees', value: rawEmployees.length, icon: <Users size={16}/>, color: 'text-violet-600 bg-violet-50' },
            { label: 'Active', value: active, icon: <CheckCircle2 size={16}/>, color: 'text-emerald-600 bg-emerald-50' },
            { label: 'Overloaded', value: rawEmployees.filter(e => e.workload_status === 'Overloaded').length, icon: <AlertTriangle size={16}/>, color: 'text-red-600 bg-red-50' },
            { label: 'On Leave', value: rawEmployees.filter(e => e.status === 'on_leave').length, icon: <Clock size={16}/>, color: 'text-amber-600 bg-amber-50' },
          ].map(s => (
            <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
              <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', s.color)}>{s.icon}</div>
              <div>
                <p className="text-xl font-bold text-slate-800">{s.value}</p>
                <p className="text-xs text-slate-500">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        {/* Search */}
        <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-sm bg-white border border-slate-200 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-violet-400 focus-within:border-transparent transition-all">
          <Search size={15} className="text-slate-400 flex-shrink-0" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email, team…"
            className="bg-transparent border-none outline-none text-sm text-slate-700 placeholder:text-slate-400 flex-1"
          />
        </div>

        {/* Filters */}
        <select
          value={filterDept} onChange={e => setFilterDept(e.target.value)}
          className="text-sm border border-slate-200 bg-white rounded-lg px-3 py-2 text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-400"
        >
          <option value="">All Departments</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>

        <select
          value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="text-sm border border-slate-200 bg-white rounded-lg px-3 py-2 text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-400"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="on_leave">On Leave</option>
          <option value="terminated">Deactivated</option>
          <option value="invited">Invited</option>
        </select>

        <select
          value={filterWorkload} onChange={e => setFilterWorkload(e.target.value)}
          className="text-sm border border-slate-200 bg-white rounded-lg px-3 py-2 text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-400"
        >
          <option value="">All Workloads</option>
          <option value="Underutilized">Underutilized</option>
          <option value="Healthy">Healthy</option>
          <option value="High">High</option>
          <option value="Overloaded">Overloaded</option>
        </select>

        <select
          value={sortBy} onChange={e => setSortBy(e.target.value as any)}
          className="text-sm border border-slate-200 bg-white rounded-lg px-3 py-2 text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-400"
        >
          <option value="name">Sort: Name</option>
          <option value="workload">Sort: Workload</option>
          <option value="tasks">Sort: Tasks</option>
          <option value="joined">Sort: Recently Joined</option>
        </select>

        <div className="ml-auto flex items-center gap-1 bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => setView('table')}
            className={cn('p-2 rounded-md transition-all', view === 'table' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-400 hover:text-slate-600')}
            title="Table view"
          >
            <LayoutList size={16} />
          </button>
          <button
            onClick={() => setView('card')}
            className={cn('p-2 rounded-md transition-all', view === 'card' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-400 hover:text-slate-600')}
            title="Card view"
          >
            <LayoutGrid size={16} />
          </button>
        </div>
      </div>

      {/* Results count */}
      <p className="text-xs text-slate-400 mb-3">
        {filtered.length} of {rawEmployees.length} employees
      </p>

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Users size={22} />}
          title={search || filterDept || filterStatus ? 'No employees match your filters' : 'No employees yet'}
          description={search ? `No results for "${search}"` : 'Add your first employee to get started.'}
          action={<Button variant="primary" onClick={() => setAddOpen(true)}><UserPlus size={14} />Add Employee</Button>}
        />
      ) : view === 'table' ? (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70">
                {['Employee', 'Job Title', 'Department', 'Teams', 'Status', 'Workload', 'Projects', 'Tasks', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(emp => (
                <TableRow key={emp.id} emp={emp} onView={id => navigate(`/people/${id}`)} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(emp => (
            <EmployeeCard key={emp.id} emp={emp} onView={id => navigate(`/people/${id}`)} />
          ))}
        </div>
      )}

      <AddEmployeeModalWrapper
        open={addOpen}
        onClose={() => setAddOpen(false)}
        departments={departments}
        employees={rawEmployees}
      />

    </div>
  );
}
