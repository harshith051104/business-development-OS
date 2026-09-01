import { api } from './api';
import type { Demo, DemoCreate } from '../types/demo';

export const demoService = {
  list: (params?: { status?: string; outcome?: string; organization_id?: number }) =>
    api.get<Demo[]>('/api/business-development/demos', params),

  getById: (id: number) =>
    api.get<Demo>(`/api/business-development/demos/${id}`),

  create: (data: DemoCreate) =>
    api.post<Demo>('/api/business-development/demos', data),

  update: (id: number, data: Partial<Demo>) =>
    api.put<Demo>(`/api/business-development/demos/${id}`, data),

  delete: (id: number) =>
    api.delete<{ message: string }>(`/api/business-development/demos/${id}`),
};
