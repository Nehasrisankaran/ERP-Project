import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/authStore';
import { orgApi } from '../../services/api';
import { Avatar, Badge, Spinner, EmptyState, PageShell, PageHeader } from '../../components/ui';
import type { Employee } from '../../types';
import { Users, MapPin, Calendar } from 'lucide-react';
import { formatDate } from '../../utils';

function EmployeeCard({ emp }: { emp: Employee }) {
  const statusColor = emp.status === 'active' ? 'text-green-700 bg-green-50' : emp.status === 'on_leave' ? 'text-amber-700 bg-amber-50' : 'text-red-700 bg-red-50';
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md hover:border-violet-200 transition-all cursor-pointer">
      <div className="flex items-start gap-4">
        <Avatar name={emp.full_name} src={emp.avatar_url} size="lg" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-slate-800 text-sm">{emp.full_name || '—'}</p>
              <p className="text-xs text-slate-500 mt-0.5">{emp.designation || 'No designation'}</p>
            </div>
            <Badge className={statusColor}>{emp.status.replace('_', ' ')}</Badge>
          </div>
          <div className="mt-3 space-y-1.5">
            {emp.department_name && (
              <p className="text-xs text-slate-400 flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded bg-slate-100 flex items-center justify-center text-[9px]">D</span>
                {emp.department_name}
              </p>
            )}
            {emp.location && (
              <p className="text-xs text-slate-400 flex items-center gap-1.5">
                <MapPin size={11} />
                {emp.location}
              </p>
            )}
            {emp.date_joined && (
              <p className="text-xs text-slate-400 flex items-center gap-1.5">
                <Calendar size={11} />
                Joined {formatDate(emp.date_joined)}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EmployeesPage() {
  const { orgId } = useAuthStore();

  const { data: rawEmployees, isLoading } = useQuery<Employee[]>({
    queryKey: ['employees', orgId],
    queryFn: async () => {
      const r = await orgApi.employees(orgId!);
      return Array.isArray(r.data) ? r.data : [];
    },
    enabled: !!orgId,
  });

  const employees = Array.isArray(rawEmployees) ? rawEmployees : [];
  const active = employees.filter(e => e.status === 'active').length;

  return (
    <PageShell>
      <PageHeader
        title="Employees"
        subtitle={`${active} active · ${employees.length} total`}
      />

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div>
      ) : employees.length === 0 ? (
        <EmptyState
          icon={<Users size={22} />}
          title="No employees yet"
          description="Add employees via the API or ask your admin to onboard team members."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {employees.map(emp => <EmployeeCard key={emp.id} emp={emp} />)}
        </div>
      )}
    </PageShell>
  );
}
