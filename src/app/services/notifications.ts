// OFJR Construction — Notification Service
import { api } from '../lib/api';
import type { CanonicalRole } from '../types';

/**
 * `notifications.i18n` (backend V95): a stable catalogue key pair plus the RAW
 * params the client interpolates — ISO dates, enum names, integer minutes,
 * integer cents, proper nouns verbatim. Null on pre-V95 rows. Resolved by
 * lib/notificationText.ts; `title`/`message` stay the English fallback.
 */
export interface NotificationI18n {
  titleKey?: string | null;
  bodyKey?: string | null;
  params?: Record<string, unknown> | null;
}

export interface NotificationResponse {
  id: number;
  type: string;
  /** Server-rendered English title — the fallback when `i18n` is absent or unknown. */
  title: string;
  /** Server-rendered English body — the fallback partner of `title`. */
  message: string;
  i18n: NotificationI18n | null;
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

/**
 * Inbox endpoint per role. The supervisor controller admits ADMIN as well
 * (`hasAnyRole('SUPERVISOR','ADMIN')`), so both read the same path. FINANCE
 * and WAREHOUSE have no endpoint yet: add their entry here when the backend
 * ships one and the shared inbox lights up for that role with no other
 * change. WORKER and SUBCONTRACTOR have endpoints of their own, but no web
 * inbox — their panel is the mobile app.
 */
const INBOX_PATHS: Partial<Record<CanonicalRole, string>> = {
  SUPERVISOR: '/api/v1/supervisor/notifications',
  ADMIN: '/api/v1/supervisor/notifications',
};

/** Whether this role has a notification inbox to show. */
export function hasNotificationInbox(role: CanonicalRole): boolean {
  return Object.prototype.hasOwnProperty.call(INBOX_PATHS, role);
}

function inboxPath(role: CanonicalRole): string {
  const path = INBOX_PATHS[role];
  if (!path) throw new Error(`No notification inbox for role ${role}`);
  return path;
}

/** Get paginated notifications for the signed-in user of this role. */
export function getNotifications(role: CanonicalRole, page = 0, size = 30): Promise<NotificationPage> {
  return api<NotificationPage>(`${inboxPath(role)}?page=${page}&size=${size}`);
}

/** Get unread notification count. */
export function getUnreadCount(role: CanonicalRole): Promise<{ count: number }> {
  return api<{ count: number }>(`${inboxPath(role)}/unread-count`);
}

/** Mark a single notification as read. */
export function markNotificationRead(role: CanonicalRole, id: number): Promise<void> {
  return api<void>(`${inboxPath(role)}/${id}/read`, { method: 'PATCH' });
}

/** Mark all notifications as read. */
export function markAllNotificationsRead(role: CanonicalRole): Promise<void> {
  return api<void>(`${inboxPath(role)}/read-all`, { method: 'PATCH' });
}
