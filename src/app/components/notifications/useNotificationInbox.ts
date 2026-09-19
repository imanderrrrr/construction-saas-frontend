import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { CanonicalRole } from '../../types';
import {
  getNotifications, getUnreadCount, hasNotificationInbox,
  markAllNotificationsRead, markNotificationRead, type NotificationResponse,
} from '../../services/notifications';

/** How often an inbox on screen asks the server for news while its tab is visible. */
export const INBOX_REFRESH_MS = 60_000;

export interface NotificationInboxState {
  /** False for a role with no inbox endpoint yet: nothing is fetched. */
  enabled: boolean;
  notifications: NotificationResponse[];
  unreadCount: number;
  loading: boolean;
  error: boolean;
  reload: () => void;
  markRead: (id: number) => Promise<void>;
  markAllRead: () => Promise<void>;
}

/**
 * The inbox's state and actions for one role, independent of where it is
 * rendered — the landing card today, a topbar bell tomorrow, both at once if
 * they ever share a provider.
 *
 * Loads on mount, then refreshes silently once a minute while the tab is
 * visible and whenever it becomes visible again. Marking read is optimistic:
 * the row flips at once and is put back, with a toast, if the server refuses.
 */
export function useNotificationInbox(role: CanonicalRole, pageSize = 20): NotificationInboxState {
  const { t } = useTranslation('notifications');
  const enabled = hasNotificationInbox(role);
  const [notifications, setNotifications] = useState<NotificationResponse[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(false);

  // Only the newest request may write: a slow first page must not overwrite a
  // row the user has since marked read, nor a fresher refresh.
  const seq = useRef(0);
  const hasData = useRef(false);
  // Snapshots the optimistic actions roll back to.
  const listRef = useRef(notifications);
  const unreadRef = useRef(unreadCount);
  useEffect(() => { listRef.current = notifications; }, [notifications]);
  useEffect(() => { unreadRef.current = unreadCount; }, [unreadCount]);

  const load = useCallback((silent: boolean) => {
    if (!enabled) return;
    const mine = ++seq.current;
    if (!silent) {
      setLoading(true);
      setError(false);
    }
    getNotifications(role, 0, pageSize)
      .then(page => {
        if (mine !== seq.current) return;
        hasData.current = true;
        setNotifications(page.content);
        setError(false);
      })
      .catch(() => {
        if (mine !== seq.current) return;
        // A background refresh that fails keeps the rows already on screen.
        if (!silent || !hasData.current) setError(true);
      })
      .finally(() => { if (mine === seq.current) setLoading(false); });
    getUnreadCount(role)
      .then(({ count }) => { if (mine === seq.current) setUnreadCount(count); })
      .catch(() => { /* the badge is non-critical; the list shows its own error */ });
  }, [enabled, role, pageSize]);

  useEffect(() => { load(false); }, [load]);

  useEffect(() => {
    if (!enabled) return;
    const refresh = () => { if (document.visibilityState === 'visible') load(true); };
    const timer = window.setInterval(refresh, INBOX_REFRESH_MS);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [enabled, load]);

  const reload = useCallback(() => load(false), [load]);

  const markRead = useCallback(async (id: number) => {
    const before = listRef.current.find(n => n.id === id);
    if (!before || before.isRead) return;
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, isRead: true } : n)));
    setUnreadCount(c => Math.max(0, c - 1));
    try {
      await markNotificationRead(role, id);
    } catch {
      setNotifications(prev => prev.map(n => (n.id === id ? before : n)));
      setUnreadCount(c => c + 1);
      toast.error(t('inbox.markReadError'));
    }
  }, [role, t]);

  const markAllRead = useCallback(async () => {
    const beforeList = listRef.current;
    const beforeUnread = unreadRef.current;
    setNotifications(prev => prev.map(n => (n.isRead ? n : { ...n, isRead: true })));
    setUnreadCount(0);
    try {
      await markAllNotificationsRead(role);
    } catch {
      setNotifications(beforeList);
      setUnreadCount(beforeUnread);
      toast.error(t('inbox.markReadError'));
    }
  }, [role, t]);

  return { enabled, notifications, unreadCount, loading, error, reload, markRead, markAllRead };
}
