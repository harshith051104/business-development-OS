import { api } from './api';
import type { DailyPrioritiesResponse } from '../types/dailyPriorities';

export const dailyPrioritiesService = {
  getPriorities: () =>
    api.get<DailyPrioritiesResponse>('/api/business-development/daily-priorities'),
};
