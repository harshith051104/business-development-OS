import { api } from './api';
import type { Customer, CustomerCreate, CustomerConvertRequest } from '../types/customer';

export const customerService = {
  list: (params?: { status?: string; health?: string; search?: string }) =>
    api.get<Customer[]>('/api/business-development/customers', params),

  getById: (id: number) =>
    api.get<Customer>(`/api/business-development/customers/${id}`),

  create: (data: CustomerCreate) =>
    api.post<Customer>('/api/business-development/customers', data),

  convert: (data: CustomerConvertRequest) =>
    api.post<Customer>('/api/business-development/customers/convert', data),

  update: (id: number, data: Partial<Customer>) =>
    api.put<Customer>(`/api/business-development/customers/${id}`, data),

  delete: (id: number) =>
    api.delete<{ message: string }>(`/api/business-development/customers/${id}`),
};
