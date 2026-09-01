import { api } from './api';
import type { FunnelReport } from '../types/reports';

export const reportService = {
  getFunnelReport: () =>
    api.get<FunnelReport>('/api/business-development/reports/funnel'),
};
