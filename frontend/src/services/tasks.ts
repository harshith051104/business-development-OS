import { api } from './api';
import type { BDTask, BDTaskCreate, TaskComment, TaskDashboard } from '../types/task';

export const taskService = {
  list: (params?: { status?: string; priority?: string; entity_type?: string; entity_id?: number }) =>
    api.get<BDTask[]>('/api/business-development/tasks', params),

  getDashboard: () =>
    api.get<TaskDashboard>('/api/business-development/tasks/dashboard'),

  getById: (id: number) =>
    api.get<BDTask>(`/api/business-development/tasks/${id}`),

  create: (data: BDTaskCreate) =>
    api.post<BDTask>('/api/business-development/tasks', data),

  update: (id: number, data: Partial<BDTask>) =>
    api.put<BDTask>(`/api/business-development/tasks/${id}`, data),

  delete: (id: number) =>
    api.delete<{ message: string }>(`/api/business-development/tasks/${id}`),

  listComments: (taskId: number) =>
    api.get<TaskComment[]>(`/api/business-development/tasks/${taskId}/comments`),

  addComment: (taskId: number, body: string) =>
    api.post<TaskComment>(`/api/business-development/tasks/${taskId}/comments`, { body }),
};
