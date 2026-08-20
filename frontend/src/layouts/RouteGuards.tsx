import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import AppShell from './AppShell';

export function ProtectedLayout() {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated());
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <AppShell><Outlet /></AppShell>;
}

export function AuthLayout() {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated());
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <Outlet />;
}
