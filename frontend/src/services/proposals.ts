import { api } from './api';
import type { Proposal, ProposalCreate } from '../types/proposal';

export const proposalService = {
  list: (params?: { status?: string; organization_id?: number }) =>
    api.get<Proposal[]>('/api/business-development/proposals', params),

  getById: (id: number) =>
    api.get<Proposal>(`/api/business-development/proposals/${id}`),

  create: (data: ProposalCreate) =>
    api.post<Proposal>('/api/business-development/proposals', data),

  update: (id: number, data: Partial<Proposal>) =>
    api.put<Proposal>(`/api/business-development/proposals/${id}`, data),

  delete: (id: number) =>
    api.delete<{ message: string }>(`/api/business-development/proposals/${id}`),
};
