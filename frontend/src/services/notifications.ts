import { api } from './api';
import type { NotificationItem } from '../types/notification';

const BASE = '/api/business-development/notifications';

export const notificationService = {
  list: (unread_only?: boolean, limit?: number) =>
    api.get<NotificationItem[]>(BASE, { unread_only, limit }),

  unreadCount: () => api.get<{ unread_count: number }>(`${BASE}/unread-count`),

  markRead: (id: number) => api.post<NotificationItem>(`${BASE}/${id}/read`),

  markAllRead: () => api.post<{ marked_read: number }>(`${BASE}/read-all`),
};
