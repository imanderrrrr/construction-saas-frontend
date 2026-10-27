import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { PublicTopbar, TopbarBackLink, TopbarLink } from '../components/landing/PublicTopbar';
import { SUPPORT_EMAIL, supportMailto } from '../lib/contact';
import { usePublicPageTitle } from '../hooks/usePublicPageTitle';
import { useSystemHealth, type Health } from '../hooks/useSystemHealth';
import {
  useStatusHistory,
  type StatusComponentKey,
  type StatusCurrent,
  type StatusDay,
  type StatusHistory,
} from '../hooks/useStatusHistory';

/**
 * Public system status, laid out like the big status pages (status.claude.com):
 * one row per component, with its state and a bar per day for the last 90 days.
 *
 * Every figure is MEASURED. The backend checks the API and the database every
 * minute and the website and file storage every 5 minutes, and publishes the
 * daily totals (`useStatusHistory`). Measuring started on the day it shipped:
 * days before that are drawn gray, "no data" — never a made-up green. When the
 * history can't be loaded, the page falls back to the live health probe it has
 * always had (`useSystemHealth`) and says so.
 */

const CONTAINER = 'mx-auto max-w-[1120px] px-[clamp(22px,5vw,56px)]';
const WINDOW_DAYS = 90;
/** On a phone the finger lifts right away: leave the day's card up long enough to read. */
const TOUCH_CARD_MS = 2_500;
const COMPONENTS: StatusComponentKey[] = ['web', 'api', 'database', 'files'];
const FOOTER_LINK = 'transition-colors hover:text-bt-bone';

/** What a component's state line says. */
type RowState = 'checking' | 'operational' | 'degraded' | 'down' | 'unknown';

const DOT: Record<RowState, string> = {
  checking: 'bg-bt-muted-2',
  operational: 'bg-bt-green',
  degraded: 'bg-bt-orange',
  down: 'bg-bt-red',
  unknown: 'bg-bt-muted-2',
};

const TEXT: Record<RowState, string> = {
  checking: 'text-bt-muted',
  operational: 'text-bt-green',
  degraded: 'text-bt-orange',
  down: 'text-bt-red',
  unknown: 'text-bt-muted',
};

/** How a day's bar is coloured, from its measured uptime. */
type Level = 'none' | 'ok' | 'minor' | 'partial' | 'major';

const BAR: Record<Level, string> = {
  none: 'bg-bt-rule',
  ok: 'bg-bt-green',
  minor: 'bg-[#d9a21b]',
  partial: 'bg-bt-orange',
  major: 'bg-bt-red',
};

const LEGEND: [Level, string][] = [
  ['ok', 'legend.ok'],
  ['minor', 'legend.minor'],
  ['partial', 'legend.partial'],
  ['major', 'legend.major'],
  ['none', 'legend.none'],
];

/** A minute-level outage (a deploy) still reads as a clean day; an hour does not. */
function dayLevel(uptimePercent: number | null): Level {
  if (uptimePercent === null) return 'none';
  if (uptimePercent >= 99.5) return 'ok';
  if (uptimePercent >= 98) return 'minor';
  if (uptimePercent >= 90) return 'partial';
  return 'major';
}

/**
 * The live probe's single verdict, for the backend-backed rows when there is no
 * measured history to go by. On `down` they say "having problems", not "down":
 * the probe proves something is failing but not which component.
 */
function liveRowState(health: Health): RowState {
  switch (health) {
    case 'up':
      return 'operational';
    case 'down':
      return 'degraded';
    case 'unknown':
      return 'unknown';
    default:
      return 'checking';
  }
}

function measuredRowState(current: StatusCurrent): RowState {
  return current === 'OPERATIONAL' ? 'operational' : current === 'DOWN' ? 'down' : 'unknown';
}

/** The last `days` calendar days ending today (local), oldest first, as YYYY-MM-DD. */
function lastDays(days: number): string[] {
  const out: string[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    out.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    );
  }
  return out;
}

/** Noon, so no time zone can push a calendar date onto the day before. */
function dateOf(iso: string): Date {
  return new Date(`${iso}T12:00:00`);
}

type Row = {
  key: StatusComponentKey;
  state: RowState;
  uptimePercent: number | null;
  history: StatusDay[];
};

function buildRows(history: StatusHistory | null, health: Health): Row[] {
  const blank = lastDays(WINDOW_DAYS).map(date => ({ date, uptimePercent: null }));
  return COMPONENTS.map(key => {
    const measured = history?.components.find(c => c.key === key);
    if (measured) {
      return {
        key,
        state: measuredRowState(measured.current),
        uptimePercent: measured.uptimePercent,
        history: measured.history.slice(-WINDOW_DAYS),
      };
    }
    // No history: what can still be said right now. This page loading proves
    // the website; the live probe covers the API and the database together;
    // nothing here speaks for file storage.
    const state: RowState =
      key === 'web' ? 'operational' : key === 'files' ? 'unknown' : liveRowState(health);
    return { key, state, uptimePercent: null, history: blank };
  });
}

function overallState(rows: Row[], history: StatusHistory | null, health: Health): RowState {
  if (!history) {
    if (health === 'checking') return 'checking';
    return health === 'up' ? 'operational' : health === 'down' ? 'degraded' : 'unknown';
  }
  if (rows.some(r => r.state === 'down')) return 'degraded';
  return rows.find(r => r.key === 'api')?.state === 'operational' ? 'operational' : 'unknown';
}

function UptimeBars({
  name,
  row,
  trackingSince,
}: {
  name: string;
  row: Row;
  trackingSince: string | null;
}) {
  const { t, i18n } = useTranslation('status');
  const [active, setActive] = useState<number | null>(null);
  const hideTimer = useRef<number | undefined>(undefined);
  const days = row.history;
  useEffect(() => () => window.clearTimeout(hideTimer.current), []);

  const percent = (value: number) =>
    new Intl.NumberFormat(i18n.language, { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 })
      .format(value / 100);
  const date = (iso: string) =>
    dateOf(iso).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short', year: 'numeric' });

  const summary =
    row.uptimePercent === null ? t('bars.noData') : t('bars.uptime', { percent: percent(row.uptimePercent) });

  // One hit area for the whole strip: the day under the pointer (or the finger).
  const pick = (event: PointerEvent<HTMLDivElement>) => {
    window.clearTimeout(hideTimer.current);
    const box = event.currentTarget.getBoundingClientRect();
    if (box.width === 0) return;
    const index = Math.floor(((event.clientX - box.left) / box.width) * days.length);
    setActive(Math.min(days.length - 1, Math.max(0, index)));
  };

  const day = active === null ? null : days[active];
  const dayNote = !day
    ? ''
    : day.uptimePercent === null
      ? trackingSince === null || day.date < trackingSince
        ? t('tooltip.notTracked')
        : t('tooltip.noData')
      : day.uptimePercent >= 100
        ? t('tooltip.noDowntime')
        : t('tooltip.uptime', { percent: percent(day.uptimePercent) });

  // Centred over its bar, but kept inside the strip at either end.
  const position = active === null ? 0 : (active + 0.5) / days.length;
  const anchor =
    position < 0.15 ? { left: 0 } : position > 0.85 ? { right: 0 } : { left: `${position * 100}%`, transform: 'translateX(-50%)' };

  return (
    <div className="relative mt-3">
      <div
        role="img"
        aria-label={t('bars.aria', { name, days: days.length, summary })}
        data-testid={`status-bars-${row.key}`}
        className="flex h-9 touch-none select-none items-stretch gap-[2px]"
        onPointerMove={pick}
        onPointerDown={pick}
        onPointerLeave={event => {
          if (event.pointerType !== 'touch') {
            setActive(null);
            return;
          }
          hideTimer.current = window.setTimeout(() => setActive(null), TOUCH_CARD_MS);
        }}
      >
        {days.map((d, i) => (
          <span
            key={d.date}
            data-level={dayLevel(d.uptimePercent)}
            className={`min-w-0 flex-1 rounded-[1px] transition-opacity ${BAR[dayLevel(d.uptimePercent)]} ${
              active !== null && active !== i ? 'opacity-70' : ''
            }`}
          />
        ))}
      </div>

      {day && (
        <div
          role="tooltip"
          className="pointer-events-none absolute bottom-[calc(100%+8px)] z-10 whitespace-nowrap rounded-[3px] border border-bt-rule bg-bt-paper px-3 py-2 shadow-[0_6px_18px_rgba(23,19,15,0.12)]"
          style={anchor}
        >
          <p className="text-[13px] font-semibold text-bt-ink">{date(day.date)}</p>
          <p className="mt-0.5 text-[12.5px] text-bt-muted">{dayNote}</p>
        </div>
      )}

      <div className="mt-2 flex items-center gap-3 text-[12.5px] text-bt-muted">
        <span>{t('bars.from', { days: days.length })}</span>
        <span aria-hidden="true" className="h-px flex-1 bg-bt-rule-2" />
        <span className="whitespace-nowrap">{summary}</span>
        <span aria-hidden="true" className="h-px flex-1 bg-bt-rule-2" />
        <span>{t('bars.today')}</span>
      </div>
    </div>
  );
}

export function Status() {
  const { t, i18n } = useTranslation('status');
  usePublicPageTitle(t('meta.title'));
  const { health, checkedAt, recheck } = useSystemHealth();
  const [historyNonce, setHistoryNonce] = useState(0);
  const historyResult = useStatusHistory(historyNonce);
  const history = historyResult.state === 'ready' ? historyResult.data : null;

  const rows = useMemo(() => buildRows(history, health), [history, health]);
  const overall = overallState(rows, history, health);
  const trackingSince = history?.trackingSince ?? null;

  const checkingAnything = health === 'checking' || historyResult.state === 'loading';
  const checkAgain = () => {
    recheck();
    setHistoryNonce(n => n + 1);
  };

  const checkedLabel =
    checkedAt === null
      ? t('checking')
      : t('checkedAt', {
          time: `${checkedAt.toLocaleDateString(i18n.language)} · ${checkedAt.toLocaleTimeString(
            i18n.language,
            { hour: '2-digit', minute: '2-digit' },
          )}`,
        });

  const sinceNote =
    historyResult.state === 'unavailable'
      ? t('unavailable')
      : history && trackingSince === null
        ? t('notStarted')
        : trackingSince
          ? t('since', {
              date: dateOf(trackingSince)
                .toLocaleDateString(i18n.language, { day: 'numeric', month: 'long', year: 'numeric' })
                .toUpperCase(),
            })
          : null;

  return (
    <div className="bt-public flex min-h-[100svh] flex-col bg-bt-paper font-bt-body text-base text-bt-ink">
      <PublicTopbar label={t('topbar.label')} containerClass={CONTAINER}>
        <TopbarLink to="/docs">{t('topbar.docs')}</TopbarLink>
        <TopbarBackLink to="/">{t('topbar.back')}</TopbarBackLink>
      </PublicTopbar>

      <main className={`${CONTAINER} w-full flex-1 py-[clamp(40px,5vw,64px)]`}>
        {/* ── Overall ──────────────────────────────────────────────── */}
        <div
          className="flex flex-wrap items-end justify-between gap-5 border-b border-bt-rule pb-[26px]"
          aria-live="polite"
        >
          <div className="flex items-center gap-4">
            <span
              aria-hidden="true"
              className={`block h-3.5 w-3.5 flex-none rounded-full ${DOT[overall]}`}
            />
            <h1 className="font-bt-heading text-[clamp(26px,3.2vw,40px)] font-bold leading-[1.05] tracking-[-0.015em] text-bt-ink">
              {t(`overall.${overall}`)}
            </h1>
          </div>
          <div className="flex items-center gap-4 pb-1.5">
            <p className="font-bt-mono text-[10.5px] tracking-[0.1em] text-bt-muted">{checkedLabel}</p>
            <button
              type="button"
              onClick={checkAgain}
              disabled={checkingAnything}
              className="rounded-[2px] border border-bt-rule px-2.5 py-1.5 font-bt-mono text-[9.5px] tracking-[0.08em] text-bt-muted transition-colors hover:border-bt-orange hover:text-bt-ink disabled:opacity-50"
            >
              {t('recheck')}
            </button>
          </div>
        </div>

        {/* ── Components, 90 days each ─────────────────────────────── */}
        <p className="mt-6 text-right text-[13px] text-bt-muted">{t('uptimeTitle', { days: WINDOW_DAYS })}</p>
        <div className="mt-3 rounded-[3px] border border-bt-rule bg-white/40">
          {rows.map(row => {
            const name = t(`component.${row.key}.name`);
            return (
              <section
                key={row.key}
                aria-label={name}
                data-testid={`status-component-${row.key}`}
                className="border-b border-bt-rule-2 px-[clamp(16px,2.4vw,26px)] py-[22px] last:border-b-0"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h2 className="text-base font-semibold text-bt-ink">{name}</h2>
                  <span className={`flex items-center gap-2 text-sm font-medium ${TEXT[row.state]}`}>
                    <span aria-hidden="true" className={`block h-2 w-2 rounded-full ${DOT[row.state]}`} />
                    {t(`state.${row.state}`)}
                  </span>
                </div>
                <UptimeBars name={name} row={row} trackingSince={trackingSince} />
              </section>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-[22px] py-4 font-bt-mono text-[9.5px] tracking-[0.12em] text-bt-muted">
          {LEGEND.map(([level, key]) => (
            <span key={key} className="flex items-center gap-[7px]">
              <span aria-hidden="true" className={`block h-2.5 w-1.5 rounded-[1px] ${BAR[level]}`} />
              {t(key)}
            </span>
          ))}
        </div>

        {!history && health === 'down' && (
          <p className="border-t border-bt-rule-2 pt-3.5 font-bt-mono text-[10px] leading-[1.8] tracking-[0.08em] text-bt-orange">
            {t('degradedNote')}
          </p>
        )}
        {!history && health === 'unknown' && (
          <p className="border-t border-bt-rule-2 pt-3.5 font-bt-mono text-[10px] leading-[1.8] tracking-[0.08em] text-bt-muted">
            {t('unknownNote')}
          </p>
        )}
        {sinceNote && (
          <p className="mt-3.5 max-w-[80ch] border-t border-bt-rule-2 pt-3.5 font-bt-mono text-[10px] leading-[1.8] tracking-[0.08em] text-bt-muted">
            {sinceNote}
          </p>
        )}
        <p className="mt-2 max-w-[80ch] font-bt-mono text-[10px] leading-[1.8] tracking-[0.08em] text-bt-muted">
          {t('method')}
        </p>

        {/* ── Incidents ────────────────────────────────────────────── */}
        <div className="mt-[clamp(36px,5vw,56px)]">
          <h2 className="mb-1.5 font-bt-heading text-[22px] font-bold tracking-[-0.01em] text-bt-ink">
            {t('incidents.title')}
          </h2>
          <p className="mb-[22px] max-w-[60ch] text-sm leading-[1.6] text-bt-muted">
            {t('incidents.subtitle')}
          </p>

          <div className="border-y border-bt-rule py-[26px]">
            <p className="max-w-[68ch] text-pretty text-[14.5px] leading-[1.6] text-bt-muted">
              {t('incidents.empty')}
            </p>
          </div>

          <p className="mt-[22px] font-bt-mono text-[10px] leading-[1.8] tracking-[0.1em] text-bt-muted">
            {t('incidents.report')}{' '}
            <a href={supportMailto()} className="text-bt-orange">
              {SUPPORT_EMAIL.toUpperCase()}
            </a>
          </p>
        </div>
      </main>

      <footer className="mt-auto bg-bt-ink">
        <div
          className={`${CONTAINER} flex flex-wrap justify-between gap-3.5 py-[22px] font-bt-mono text-[10px] tracking-[0.1em] text-bt-muted`}
        >
          <span>{t('footer.copy')}</span>
          {/* The same way out as the landing's footer: docs and the legal pages. */}
          <span className="flex flex-wrap gap-x-5 gap-y-2">
            <Link to="/docs" className={FOOTER_LINK}>{t('footer.docs')}</Link>
            <Link to="/privacy" className={FOOTER_LINK}>{t('footer.privacy')}</Link>
            <Link to="/terms" className={FOOTER_LINK}>{t('footer.terms')}</Link>
          </span>
          <span>{t('footer.coord')}</span>
        </div>
      </footer>
    </div>
  );
}
