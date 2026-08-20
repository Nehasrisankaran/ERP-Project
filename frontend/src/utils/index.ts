import clsx from 'clsx';
import type { Priority, TaskStatus, ProjectStatus } from '../types';

export function cn(...classes: (string | undefined | null | false)[]) {
  return clsx(...classes);
}

export const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; bg: string; dot: string }> = {
  low:      { label: 'Low',      color: 'text-slate-500',  bg: 'bg-slate-100',  dot: 'bg-slate-400' },
  medium:   { label: 'Medium',   color: 'text-amber-700',  bg: 'bg-amber-50',   dot: 'bg-amber-400' },
  high:     { label: 'High',     color: 'text-orange-700', bg: 'bg-orange-50',  dot: 'bg-orange-500' },
  critical: { label: 'Critical', color: 'text-red-700',    bg: 'bg-red-50',     dot: 'bg-red-500' },
};

export const TASK_STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; bg: string }> = {
  not_started: { label: 'Not Started', color: 'text-slate-600', bg: 'bg-slate-100' },
  in_progress: { label: 'In Progress', color: 'text-blue-700', bg: 'bg-blue-50' },
  in_review: { label: 'In Review', color: 'text-purple-700', bg: 'bg-purple-50' },
  blocked: { label: 'Blocked', color: 'text-red-700', bg: 'bg-red-50' },
  completed: { label: 'Completed', color: 'text-green-700', bg: 'bg-green-50' },
  cancelled: { label: 'Cancelled', color: 'text-slate-500', bg: 'bg-slate-100' },
};

export const PROJECT_STATUS_CONFIG: Record<ProjectStatus, { label: string; color: string }> = {
  planning: { label: 'Planning', color: 'text-slate-600 bg-slate-100' },
  active: { label: 'Active', color: 'text-green-700 bg-green-50' },
  on_hold: { label: 'On Hold', color: 'text-amber-700 bg-amber-50' },
  completed: { label: 'Completed', color: 'text-blue-700 bg-blue-50' },
  cancelled: { label: 'Cancelled', color: 'text-red-700 bg-red-50' },
};

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export function getProjectProgress(taskCount: number, completedCount: number): number {
  if (!taskCount) return 0;
  return Math.round((completedCount / taskCount) * 100);
}
