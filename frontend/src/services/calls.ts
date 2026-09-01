import { api } from './api';
import type { CallLog, CallLogRequest } from '../types/call';

export const callService = {
  list: (params?: { organization_id?: number; contact_id?: number }) =>
    api.get<CallLog[]>('/api/business-development/calls', params),

  logCall: (data: CallLogRequest) =>
    api.post<CallLog>('/api/business-development/calls', data),
};
