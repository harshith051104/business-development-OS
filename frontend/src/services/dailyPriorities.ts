import { api } from './api';
import type { DailyPrioritiesResponse, OrganizationQueueResponse } from '../types/dailyPriorities';

export const dailyPrioritiesService = {
  getPriorities: () =>
    api.get<DailyPrioritiesResponse>('/api/business-development/daily-priorities'),

  getOrganizationQueue: () =>
    api.get<OrganizationQueueResponse>('/api/business-development/daily-priorities/organization-queue', {
      utc_offset_minutes: -new Date().getTimezoneOffset(),
    }),
};
