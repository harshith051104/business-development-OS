import { api } from './api';
import type { Negotiation, NegotiationCreate } from '../types/negotiation';

export const negotiationService = {
  list: (params?: { status?: string; organization_id?: number }) =>
    api.get<Negotiation[]>('/api/business-development/negotiations', params),

  getById: (id: number) =>
    api.get<Negotiation>(`/api/business-development/negotiations/${id}`),

  create: (data: NegotiationCreate) =>
    api.post<Negotiation>('/api/business-development/negotiations', data),

  update: (id: number, data: Partial<Negotiation>) =>
    api.put<Negotiation>(`/api/business-development/negotiations/${id}`, data),

  delete: (id: number) =>
    api.delete<{ message: string }>(`/api/business-development/negotiations/${id}`),
};
