// OFJR Construction — Notification Service
import { api } from '../lib/api';

export interface NotificationResponse {
  id: number;
  type: string;
  title: string;
  message: string;
  relatedEntityType: string | null;
  relatedEntityId: number | null;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
}

export interface NotificationPage {
  content: NotificationResponse[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

/** Get paginated notifications for the current user (supervisor/admin). */
export function getSupervisorNotifications(page = 0, size = 30): Promise<NotificationPage> {
  return api<NotificationPage>(`/api/v1/supervisor/notifications?page=${page}&size=${size}`);
}

/** Get unread notification count. */
export function getSupervisorUnreadCount(): Promise<{ count: number }> {
  return api<{ count: number }>('/api/v1/supervisor/notifications/unread-count');
}

/** Mark a single notification as read. */
export function markNotificationRead(id: number): Promise<void> {
  return api<void>(`/api/v1/supervisor/notifications/${id}/read`, { method: 'PATCH' });
}

/** Mark all notifications as read. */
export function markAllNotificationsRead(): Promise<void> {
  return api<void>('/api/v1/supervisor/notifications/read-all', { method: 'PATCH' });
}
