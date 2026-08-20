import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  orgId: number | null;
  setAuth: (user: User, access: string, refresh: string) => void;
  setUser: (user: User) => void;
  setOrgId: (id: number) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      orgId: null,
      setAuth: (user, access, refresh) => {
        localStorage.setItem('access_token', access);
        localStorage.setItem('refresh_token', refresh);
        set({ user, accessToken: access, refreshToken: refresh, orgId: user.organization_id });
      },
      setUser: (user) => set({ user }),
      setOrgId: (id) => set({ orgId: id }),
      logout: () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        set({ user: null, accessToken: null, refreshToken: null, orgId: null });
      },
      isAuthenticated: () => !!get().accessToken && !!get().user,
    }),
    { name: 'workmate-auth' }
  )
);
