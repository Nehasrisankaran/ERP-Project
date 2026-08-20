import { taskApi } from './api';
import { projectManagerService } from './projectManagerService';
import type { Task } from '../types';

export type TaskSourceType = 'workmate' | 'sharepoint_task';

export interface UnifiedTask {
  id: string | number;
  title: string;
  description?: string;
  project: string;
  assignee: string;
  status: 'todo' | 'in_progress' | 'completed' | 'cancelled' | string;
  priority: 'low' | 'medium' | 'high' | 'urgent' | string;
  startDate?: string;
  dueDate?: string;
  eta?: string;
  progress?: number;
  source: TaskSourceType;
  sourceId: string;
  sourceMetadata?: Record<string, any>;
  remarks?: string;
  module?: string;
}

export function normalizeWorkmateTask(task: Task): UnifiedTask {
  return {
    id: `workmate-${task.id}`,
    title: task.title,
    description: task.description || '',
    project: task.project_name || 'WORKMATE Project',
    assignee: task.assignee_name || 'Unassigned',
    status: task.status || 'todo',
    priority: task.priority || 'medium',
    dueDate: task.due_date || undefined,
    eta: task.due_date || undefined,
    source: 'workmate',
    sourceId: String(task.id),
    sourceMetadata: {
      rawTask: task,
      projectId: task.project_id,
      assigneeId: task.assignee_id,
    },
  };
}

export function normalizeSharePointTask(pmTask: any): UnifiedTask {
  let mappedStatus = 'in_progress';
  const st = (pmTask.status || '').toLowerCase();
  if (st.includes('complete') || st.includes('done')) {
    mappedStatus = 'completed';
  } else if (st.includes('yet to start') || st.includes('todo') || st.includes('pending')) {
    mappedStatus = 'todo';
  } else if (st.includes('block') || st.includes('delay')) {
    mappedStatus = 'in_progress';
  }

  let mappedPriority = 'medium';
  if (pmTask.category === 'overdue') {
    mappedPriority = 'urgent';
  } else if (pmTask.category === 'due_today') {
    mappedPriority = 'high';
  }

  const rawId = pmTask.row_id || `${pmTask.project}-${pmTask.task}-${pmTask.assignee}`;

  return {
    id: `sp-${rawId}`,
    title: pmTask.task || 'Untitled SharePoint Task',
    description: pmTask.description !== '-' ? pmTask.description : '',
    project: pmTask.project || 'SharePoint Project',
    assignee: pmTask.assignee || 'Unassigned',
    status: mappedStatus,
    priority: mappedPriority,
    startDate: pmTask.start_date_str !== '-' ? pmTask.start_date_str : undefined,
    dueDate: pmTask.eta_str !== '-' ? pmTask.eta_str : undefined,
    eta: pmTask.eta_str !== '-' ? pmTask.eta_str : undefined,
    source: 'sharepoint_task',
    sourceId: String(rawId),
    remarks: pmTask.remarks !== '-' ? pmTask.remarks : undefined,
    module: pmTask.module !== '-' ? pmTask.module : undefined,
    sourceMetadata: {
      rawTask: pmTask,
      workbook: pmTask.sheet || pmTask.project,
      sheet: pmTask.sheet || 'Task Tracker',
      row: pmTask.row_id,
    },
  };
}

export const myWorkService = {
  async getUnifiedMyTasks(orgId?: number, userEmail?: string, userName?: string): Promise<{ tasks: UnifiedTask[]; lastSyncedAt: string; errors: { workmate?: string; sharepoint?: string } }> {
    const errors: { workmate?: string; sharepoint?: string } = {};
    let workmateNormalized: UnifiedTask[] = [];
    let spNormalized: UnifiedTask[] = [];

    // 1. Fetch Native WORKMATE tasks
    try {
      if (orgId) {
        const res = await taskApi.myTasks(orgId);
        const rawArr = Array.isArray(res.data) ? res.data : [];
        workmateNormalized = rawArr.map(normalizeWorkmateTask);
      }
    } catch (err: any) {
      console.error('Failed to load native WORKMATE tasks:', err);
      errors.workmate = err?.response?.data?.detail || err?.message || 'Failed to fetch WORKMATE tasks';
    }

    // 2. Fetch Project Manager / SharePoint Tasks
    try {
      const pmRes = await projectManagerService.getTasks();
      const pmArr = pmRes.data?.tasks || [];
      
      // Filter for current user if email or name matches, or show user's assigned tasks
      const userSpTasks = pmArr.filter((t: any) => {
        if (!userName && !userEmail) return true;
        const assignee = (t.assignee || '').toLowerCase();
        const uName = (userName || '').toLowerCase();
        const uEmail = (userEmail || '').toLowerCase();
        if (uName && assignee.includes(uName)) return true;
        if (uEmail && assignee.includes(uEmail.split('@')[0])) return true;
        return true; // Return all tasks returned by PM endpoints if non-restricted or fallback
      });

      spNormalized = userSpTasks.map(normalizeSharePointTask);
    } catch (err: any) {
      console.error('Failed to load SharePoint tasks:', err);
      errors.sharepoint = err?.response?.data?.detail || err?.message || 'Failed to fetch SharePoint tasks';
    }

    // 3. Deduplicate
    const combined = [...workmateNormalized, ...spNormalized];
    const deduplicatedMap = new Map<string, UnifiedTask>();

    for (const task of combined) {
      const key = `${task.source}-${task.sourceId}`;
      if (!deduplicatedMap.has(key)) {
        deduplicatedMap.set(key, task);
      }
    }

    return {
      tasks: Array.from(deduplicatedMap.values()),
      lastSyncedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      errors,
    };
  },
};
