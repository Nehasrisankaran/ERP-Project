import React from 'react';
import { useAuthStore } from '../../stores/authStore';
import { PageShell, PageHeader } from '../../components/ui';
import { Briefcase, Plus, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

import { resolveDashboardRole, getDashboardConfig } from './config/dashboardConfig';
import type { DashboardRole } from './config/dashboardConfig';
import { useDashboard } from './services/dashboardService';
import { 
  EmployeeDashboard, 
  ManagerDashboard, 
  AdminDashboard, 
  ProjectManagerDashboard, 
  HRDashboard 
} from './containers';

// ── Empty workspace onboarding ────────────────────────────
function EmptyWorkspace() {
  return (
    <PageShell>
      <PageHeader showBack={false} title="Welcome to WorkMate" subtitle="Your account isn't linked to an organization yet." />
      <div className="max-w-xl mx-auto mt-12 text-center">
        <div className="w-16 h-16 bg-violet-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <Briefcase size={28} className="text-violet-500" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Welcome to WorkMate</h2>
        <p className="text-slate-500 text-sm mb-8">Let's get your workspace moving.</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/projects"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-violet-600 text-white text-sm font-medium rounded-xl hover:bg-violet-700 transition-colors shadow-sm"
          >
            <Plus size={16} /> Create your first project
          </Link>
          <Link
            to="/employees"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
          >
            <Users size={16} /> Invite your team
          </Link>
        </div>
      </div>
    </PageShell>
  );
}

// ── Registry ──────────────────────────────────────────────
const dashboardRegistry: Record<DashboardRole, React.FC<any>> = {
  employee: EmployeeDashboard,
  manager: ManagerDashboard,
  admin: AdminDashboard,
  project_manager: ProjectManagerDashboard,
  hr: HRDashboard,
  department_head: ManagerDashboard, // Fallback to Manager for now until implemented
  ceo: AdminDashboard, // Fallback to Admin for now until implemented
};

// ── Dispatcher ────────────────────────────────────────────
export default function DashboardPage() {
  const { orgId, user } = useAuthStore();
  const { data, isLoading, isError, refetch } = useDashboard();

  if (!orgId) {
    return <EmptyWorkspace />;
  }

  if (isLoading) {
    return (
      <PageShell>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600 mb-4"></div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Loading your dashboard...</h2>
        </div>
      </PageShell>
    );
  }

  if (isError) {
    return (
      <PageShell>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <h2 className="text-xl font-bold text-red-600 mb-2">Unable to load your dashboard.</h2>
          <p className="text-slate-500 text-sm max-w-md mb-4">
            There was a problem retrieving your dashboard data.
          </p>
          <button 
            onClick={() => refetch()}
            className="px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </PageShell>
    );
  }

  // 1. Determine effective role (Backend is authority, fallback to frontend user role if not present)
  let backendRoleStr = data?.role;
  if (!backendRoleStr) backendRoleStr = user?.role;
  const role = resolveDashboardRole(backendRoleStr);
  
  // 2. Resolve role configuration
  const config = getDashboardConfig(role);
  
  // 3. Dispatch to appropriate role dashboard
  const DashboardComponent = dashboardRegistry[role];

  if (!DashboardComponent) {
    return (
      <PageShell>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <h2 className="text-xl font-bold text-slate-800 mb-2">Dashboard Not Configured</h2>
          <p className="text-slate-500 text-sm max-w-md">
            Your current role does not have a configured dashboard view. Please contact your administrator.
          </p>
        </div>
      </PageShell>
    );
  }

  return (
    <DashboardComponent 
      user={user} 
      config={config} 
      data={data}
    />
  );
}
