import { useTranslation } from 'react-i18next';

import { PublicTopbar, TopbarBackLink, TopbarLink } from '../components/landing/PublicTopbar';
import { BETA_EMAIL } from '../components/landing/contact';
import { usePublicPageTitle } from '../hooks/usePublicPageTitle';
import { useSystemHealth, type Health } from '../hooks/useSystemHealth';

/**
 * Public system status.
 *
 * The design sheet ("BuildTrack Estado") carried hard-coded uptime figures, 90
 * days of history bars and three worked-example incidents. None of that is
 * measured anywhere, so publishing it would be inventing a track record. This
 * page instead shows what can actually be known right now: a live health probe
 * run when the page opens, and an honest statement that the incident history
 * starts from here.
 *
 * The visual language of the sheet is kept — the same status rows, dots,
 * legend and title — but every row states where its verdict comes from.
 */

const CONTAINER = 'mx-auto max-w-[1120px] px-[clamp(22px,5vw,56px)]';

/** What a single row is reporting. */
type RowState = 'checking' | 'operational' | 'degraded' | 'down' | 'unknown';

const DOT: Record<RowState, string> = {
  checking: 'bg-bt-muted-2',
  operational: 'bg-bt-green',
  degraded: 'bg-bt-orange',
  down: 'bg-bt-red',
  unknown: 'bg-bt-muted-2',
};

const TEXT: Record<RowState, string> = {
  checking: 'text-bt-muted-2',
  operational: 'text-bt-green',
  degraded: 'text-bt-orange',
  down: 'text-bt-red',
  unknown: 'text-bt-muted-2',
};

const STATE_KEY: Record<RowState, string> = {
  checking: 'state.checking',
  operational: 'state.operational',
  degraded: 'state.degraded',
  down: 'state.down',
  unknown: 'state.unknown',
};

/**
 * Map the single aggregate verdict onto the backend-backed rows.
 *
 * On `down` the rows say "degraded", not "down": the probe proves something is
 * failing but not which component, and naming the wrong one is its own kind of
 * lying.
 */
function backendRowState(health: Health): RowState {
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

function ServiceRow({
  name,
  note,
  state,
  stateLabel,
}: {
  name: string;
  note: string;
  state: RowState;
  stateLabel: string;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-bt-rule-2 py-[22px]">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className={`block h-[9px] w-[9px] flex-none rounded-full ${DOT[state]}`} />
        <span className="text-base font-semibold text-bt-ink">{name}</span>
        <span className={`font-bt-mono text-[9.5px] tracking-[0.12em] ${TEXT[state]}`}>{stateLabel}</span>
      </div>
      {/* Where this verdict comes from — the slot the design gave to uptime %. */}
      <span className="font-bt-mono text-[9.5px] tracking-[0.06em] text-bt-muted-2">{note}</span>
    </div>
  );
}

export function Status() {
  const { t, i18n } = useTranslation('status');
  usePublicPageTitle(t('meta.title'));
  const { health, checkedAt, recheck } = useSystemHealth();

  // The web app is the one thing we can assert without asking anyone: this
  // page is running, so it is up.
  const web: RowState = 'operational';
  const backend = backendRowState(health);

  const overall: RowState =
    health === 'checking'
      ? 'checking'
      : health === 'up'
        ? 'operational'
        : health === 'down'
          ? 'degraded'
          : 'unknown';

  const overallKey =
    overall === 'checking'
      ? 'overall.checking'
      : overall === 'operational'
        ? 'overall.operational'
        : overall === 'degraded'
          ? 'overall.degraded'
          : 'overall.unknown';

  const checkedLabel =
    checkedAt === null
      ? t('checking')
      : t('checkedAt', {
          time: `${checkedAt.toLocaleDateString(i18n.language)} · ${checkedAt.toLocaleTimeString(
            i18n.language,
            { hour: '2-digit', minute: '2-digit' },
          )}`,
        });

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
              {t(overallKey)}
            </h1>
          </div>
          <div className="flex items-center gap-4 pb-1.5">
            <p className="font-bt-mono text-[10.5px] tracking-[0.1em] text-bt-muted">{checkedLabel}</p>
            <button
              type="button"
              onClick={recheck}
              disabled={health === 'checking'}
              className="rounded-[2px] border border-bt-rule px-2.5 py-1.5 font-bt-mono text-[9.5px] tracking-[0.08em] text-bt-muted transition-colors hover:border-bt-orange hover:text-bt-ink disabled:opacity-50"
            >
              {t('recheck')}
            </button>
          </div>
        </div>

        {/* ── Services ─────────────────────────────────────────────── */}
        <div className="mt-2">
          <ServiceRow
            name={t('service.web.name')}
            note={t('service.web.note')}
            state={web}
            stateLabel={t(STATE_KEY[web])}
          />
          <ServiceRow
            name={t('service.api.name')}
            note={t('service.api.note')}
            state={backend}
            stateLabel={t(STATE_KEY[backend])}
          />
          <ServiceRow
            name={t('service.db.name')}
            note={t('service.db.note')}
            state={backend}
            stateLabel={t(STATE_KEY[backend])}
          />

          <div className="flex flex-wrap gap-[22px] py-4 font-bt-mono text-[9.5px] tracking-[0.12em] text-bt-muted">
            {(
              [
                ['bg-bt-green', 'legend.operational'],
                ['bg-bt-orange', 'legend.degraded'],
                ['bg-bt-red', 'legend.down'],
                ['bg-bt-muted-2', 'legend.unknown'],
              ] as [string, string][]
            ).map(([dot, key]) => (
              <span key={key} className="flex items-center gap-[7px]">
                <span aria-hidden="true" className={`block h-2 w-2 ${dot}`} />
                {t(key)}
              </span>
            ))}
          </div>

          {health === 'down' && (
            <p className="border-t border-bt-rule-2 pt-3.5 font-bt-mono text-[10px] leading-[1.8] tracking-[0.08em] text-bt-orange">
              {t('degradedNote')}
            </p>
          )}
          {health === 'unknown' && (
            <p className="border-t border-bt-rule-2 pt-3.5 font-bt-mono text-[10px] leading-[1.8] tracking-[0.08em] text-bt-muted">
              {t('unknownNote')}
            </p>
          )}

          <p className="mt-3.5 max-w-[80ch] border-t border-bt-rule-2 pt-3.5 font-bt-mono text-[10px] leading-[1.8] tracking-[0.08em] text-bt-muted">
            {t('noHistory')}
          </p>
        </div>

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
            <a href={`mailto:${BETA_EMAIL}`} className="text-bt-orange">
              {BETA_EMAIL.toUpperCase()}
            </a>
          </p>
        </div>
      </main>

      <footer className="mt-auto bg-bt-ink">
        <div
          className={`${CONTAINER} flex flex-wrap justify-between gap-3.5 py-[22px] font-bt-mono text-[10px] tracking-[0.1em] text-bt-muted`}
        >
          <span>{t('footer.copy')}</span>
          <span>{t('footer.coord')}</span>
        </div>
      </footer>
    </div>
  );
}
