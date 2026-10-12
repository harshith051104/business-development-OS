import { api } from './api';
import type { SignalItem } from '../types/signal';

const BASE = '/api/business-development/signals';

export const signalService = {
  list: (limit?: number) => api.get<SignalItem[]>(BASE, { limit }),

  dismiss: (id: number) => api.post<SignalItem>(`${BASE}/${id}/dismiss`),
};
