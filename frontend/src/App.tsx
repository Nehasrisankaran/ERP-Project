import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProtectedLayout, AuthLayout } from './layouts/RouteGuards';
import { ErrorBoundary } from './components/ui/ErrorBoundary';

// Auth pages
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';

// App pages
import DashboardPage from './pages/dashboard/DashboardPage';
import ProjectsPage from './pages/projects/ProjectsPage';
import ProjectDetailPage from './pages/projects/ProjectDetailPage';
import PeoplePage from './pages/employees/PeoplePage';
import EmployeeProfilePage from './pages/employees/EmployeeProfilePage';
import TeamsPage from './pages/teams/TeamsPage';
import DepartmentsPage from './pages/departments/DepartmentsPage';
import DepartmentDetailsPage from './pages/departments/DepartmentDetailsPage';
import MyWorkPage from './pages/mywork/MyWorkPage';
import SettingsPage from './pages/settings/SettingsPage';

import ReportsPage from './pages/reports/ReportsPage';
import MoreToolsPage from './pages/more/MoreToolsPage';
import GlobalCalendarPage from './pages/calendar/GlobalCalendarPage';

// Project Manager pages

import PMOverviewPage from './pages/projectManager/PMOverviewPage';
import AllTasksPage from './pages/projectManager/AllTasksPage';
import PendingTodayPage from './pages/projectManager/PendingTodayPage';
import ResourceUtilizationPage from './pages/projectManager/ResourceUtilizationPage';
import DeliveryRisksPage from './pages/projectManager/DeliveryRisksPage';
import MilestonesPage from './pages/projectManager/MilestonesPage';
import EmployeeEvaluationPage from './pages/projectManager/EmployeeEvaluationPage';
import TeamsRepliesPage from './pages/projectManager/TeamsRepliesPage';
import ReminderHistoryPage from './pages/projectManager/ReminderHistoryPage';
import ExecutiveSummaryPage from './pages/projectManager/ExecutiveSummaryPage';
import ActivityLogPage from './pages/projectManager/ActivityLogPage';
import ExcelViewerPage from './pages/projectManager/ExcelViewerPage';
import PMLayout from './pages/projectManager/PMLayout';

import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

function PlaceholderPage({ title }: { title: string }) {
  const navigate = useNavigate();
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="group flex items-center justify-center w-8 h-8 bg-white border border-slate-200 text-slate-400 hover:text-slate-700 hover:border-slate-300 rounded-full transition-all shadow-sm hover:shadow mb-4 shrink-0"
        title="Go Back"
      >
        <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
      </button>
      <h1 className="text-2xl font-bold text-slate-800 mb-2">{title}</h1>
      <p className="text-slate-500 text-sm">This module is part of the upcoming WORKMATE expansion release.</p>
    </div>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            {/* Auth routes — redirect to / if already logged in */}
            <Route element={<AuthLayout />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            </Route>

            {/* Protected app routes */}
            <Route element={<ProtectedLayout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/projects/:id" element={<ProjectDetailPage />} />
              <Route path="/employees" element={<PeoplePage />} />
              <Route path="/people" element={<PeoplePage />} />
              <Route path="/people/:id" element={<EmployeeProfilePage />} />
              <Route path="/teams" element={<TeamsPage />} />
              <Route path="/departments" element={<DepartmentsPage />} />
              <Route path="/departments/:id" element={<DepartmentDetailsPage />} />
              <Route path="/my-work" element={<MyWorkPage />} />
              <Route path="/calendar" element={<GlobalCalendarPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/more" element={<MoreToolsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/profile" element={<Navigate to="/settings" replace />} />
              <Route path="/people/me" element={<Navigate to="/settings" replace />} />
              <Route path="/insights" element={<PlaceholderPage title="Insights" />} />
              <Route path="/organization" element={<PlaceholderPage title="Organization" />} />

              {/* Redirect legacy PM my-work route to unified hub */}
              <Route path="/project-manager/my-work" element={<Navigate to="/my-work" replace />} />


              {/* Project Manager module routes */}
              <Route path="/project-manager" element={<PMLayout />}>
                <Route index element={<Navigate to="/project-manager/overview" replace />} />
                <Route path="overview" element={<PMOverviewPage />} />
                <Route path="all-tasks" element={<AllTasksPage />} />
                <Route path="pending-today" element={<PendingTodayPage />} />
                <Route path="resource-utilization" element={<ResourceUtilizationPage />} />
                <Route path="delivery-risks" element={<DeliveryRisksPage />} />
                <Route path="milestones" element={<MilestonesPage />} />
                <Route path="employee-evaluation" element={<EmployeeEvaluationPage />} />
                <Route path="teams-replies" element={<TeamsRepliesPage />} />
                <Route path="reminder-history" element={<ReminderHistoryPage />} />
                <Route path="executive-summary" element={<ExecutiveSummaryPage />} />
                <Route path="activity-log" element={<ActivityLogPage />} />
                <Route path="excel-viewer" element={<ExcelViewerPage />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

