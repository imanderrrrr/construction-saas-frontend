import { CheckCheck, Inbox, Loader2, Mail, MailOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CanonicalRole } from '../../types';
import { ErrorBanner } from '../ErrorBanner';
import { fmtDate } from '../../helpers/dateTime';
import { notificationText } from '../../lib/notificationText';
import { useNotificationInbox } from './useNotificationInbox';

/**
 * The in-app notification inbox: one card, mounted on the landing of every
 * role that has an endpoint behind it (services/notifications.ts decides;
 * for any other role this renders nothing). Rows are composed in the panel's
 * language by lib/notificationText, with the server's English as fallback.
 *
 * Shell-agnostic on purpose. The chassis is kept as three hand-synced copies
 * (AppShell, AdminDashboard, WarehouseDashboard), so a card each dashboard
 * mounts is one line per panel and reaches all of them; a topbar bell can
 * later read the same hook without touching this card.
 */
export function NotificationInbox({ role }: { role: CanonicalRole }) {
  const { t, i18n } = useTranslation('notifications');
  const inbox = useNotificationInbox(role);

  if (!inbox.enabled) return null;

  return (
    <section
      aria-label={t('inbox.title')}
      data-testid="notification-inbox"
      className="rounded-xl border border-[#D4D4D8] bg-white p-4 sm:p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Inbox className="w-5 h-5 text-[#F97316]" />
          <h3 className="text-base font-semibold text-[#0A0A0A]">{t('inbox.title')}</h3>
          {inbox.unreadCount > 0 && (
            <span
              title={t('inbox.unread', { count: inbox.unreadCount })}
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#F97316]/10 text-[#F97316] border border-[#F97316]/20"
            >
              {inbox.unreadCount}
            </span>
          )}
        </div>
        {inbox.unreadCount > 0 && (
          <button
            type="button"
            onClick={() => { void inbox.markAllRead(); }}
            className="flex items-center gap-1 text-xs text-[#F97316] hover:underline font-medium"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            {t('inbox.markAllRead')}
          </button>
        )}
      </div>

      {inbox.loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-[#F97316]" />
        </div>
      ) : inbox.error ? (
        <div data-testid="notification-inbox-load-error">
          <ErrorBanner message={t('inbox.loadError')} onRetry={inbox.reload} />
        </div>
      ) : inbox.notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-10 h-10 bg-[#FAFAFA] rounded-full flex items-center justify-center mb-3">
            <Inbox className="w-5 h-5 text-[#D4D4D8]" />
          </div>
          <p className="text-sm font-medium text-[#71717A]">{t('inbox.empty')}</p>
          <p className="text-[11px] text-[#71717A] mt-0.5">{t('inbox.emptyHint')}</p>
        </div>
      ) : (
        <ul className="space-y-0.5 max-h-[320px] overflow-y-auto">
          {inbox.notifications.map(n => {
            const text = notificationText(n, t, i18n.language);
            return (
              <li key={n.id}>
                <button
                  type="button"
                  data-testid="notification-row"
                  data-read={n.isRead ? 'true' : 'false'}
                  title={n.isRead ? undefined : t('inbox.markRead')}
                  onClick={() => { if (!n.isRead) void inbox.markRead(n.id); }}
                  className={`w-full text-left flex gap-3 py-2.5 px-2 -mx-1 rounded-lg transition-colors ${
                    n.isRead ? 'opacity-60 hover:opacity-80 cursor-default' : 'bg-[#F97316]/[0.03] hover:bg-[#F97316]/[0.06]'
                  }`}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {n.isRead
                      ? <MailOpen className="w-4 h-4 text-[#71717A]" />
                      : <Mail className="w-4 h-4 text-[#F97316]" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${n.isRead ? 'text-[#71717A]' : 'text-[#0A0A0A] font-medium'}`}>
                      {text.title}
                    </p>
                    <p className="text-[11px] text-[#71717A] mt-0.5 line-clamp-2">{text.body}</p>
                    <p className="text-[10px] text-[#71717A] mt-1">{whenLabel(n.createdAt, i18n.language, t('inbox.justNow'))}</p>
                  </div>
                  {!n.isRead && (
                    <div className="w-2 h-2 rounded-full bg-[#F97316] flex-shrink-0 mt-2" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/**
 * "hace 5 minutos" / "5 minutes ago", then hours, then days ("ayer"), and the
 * plain date past a week — from Intl, so it follows the language toggle with
 * no strings of its own beyond the first minute.
 */
export function whenLabel(iso: string, lang: string, justNow: string, now: number = Date.now()): string {
  const locale = lang.startsWith('es') ? 'es-GT' : 'en-US';
  const minutes = Math.floor((now - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return justNow;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (minutes < 60) return rtf.format(-minutes, 'minute');
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return rtf.format(-hours, 'hour');
  const days = Math.floor(hours / 24);
  if (days < 7) return rtf.format(-days, 'day');
  return fmtDate(iso, locale);
}
