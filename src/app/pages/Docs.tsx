import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';

import { PublicTopbar, TopbarBackLink, TopbarLink } from '../components/landing/PublicTopbar';
import { SUPPORT_EMAIL, supportMailto } from '../lib/contact';
import { usePublicPageTitle } from '../hooks/usePublicPageTitle';
import { FIELD_LIMITS } from '../../shared/fieldLimits';

/**
 * Public documentation — one short guide per module, grouped the way a
 * construction company runs: the office and its money, the crew, the site,
 * the client, the phone, and the controls around all of it.
 *
 * Ported from the Claude Design sheet "BuildTrack Docs". The copy deliberately
 * describes only what the system does today; if a step isn't in the product,
 * it isn't in here. Each module leads with what the buyer gets (`.sub`, `.gain`)
 * and who uses it (`.who`), but every step underneath is a behaviour the code
 * has — verified against the panel, the API and the field app on 2026-10-27.
 */

const CONTAINER = 'mx-auto max-w-[1400px] px-[clamp(22px,5vw,64px)]';

type Group = {
  /** Key prefix for this group's steps, e.g. `s2.a` → `s2.a.step.1.bold`. */
  keyBase: string;
  labelKey?: string;
  steps: number;
};

type NavGroup = 'start' | 'money' | 'team' | 'site' | 'client' | 'field' | 'trust';

type Section = {
  /** Anchor id, also the search-index key. */
  id: string;
  /** Key prefix covering every string in the section. */
  prefix: string;
  navKey: string;
  /** Side-nav heading the section is listed under (`nav.group.<navGroup>`). */
  navGroup: NavGroup;
  groups: Group[];
  noteKey?: string;
  /** Module sections also carry `<prefix>.who` and `<prefix>.gain`. */
  pitch?: boolean;
};

const NAV_GROUPS: NavGroup[] = ['start', 'money', 'team', 'site', 'client', 'field', 'trust'];

/** A module guide: one plain group of steps, plus the who/gain pitch. */
function moduleGuide(id: string, n: number, navGroup: NavGroup, steps: number, noteKey?: string): Section {
  const prefix = `s${n}`;
  return { id, prefix, navKey: `nav.${n}`, navGroup, groups: [{ keyBase: prefix, steps }], noteKey, pitch: true };
}

const SECTIONS: Section[] = [
  { id: 'primeros-pasos', prefix: 's0', navKey: 'nav.start', navGroup: 'start', groups: [{ keyBase: 's0', steps: 4 }], noteKey: 's0.note' },
  moduleGuide('doc-proyectos', 1, 'money', 6),
  moduleGuide('doc-presupuestos', 2, 'money', 5),
  moduleGuide('doc-cobros', 3, 'money', 5),
  moduleGuide('doc-pagos', 4, 'money', 6),
  moduleGuide('doc-gastos', 5, 'money', 4),
  moduleGuide('doc-quickbooks', 6, 'money', 5),
  moduleGuide('doc-asistencia', 7, 'team', 5),
  moduleGuide('doc-herramientas', 8, 'team', 5),
  moduleGuide('doc-subcontratistas', 9, 'team', 4),
  moduleGuide('doc-bitacora', 10, 'site', 4),
  moduleGuide('doc-pendientes', 11, 'site', 4),
  moduleGuide('doc-rfi', 12, 'site', 3, 's12.note'),
  moduleGuide('doc-tiempo-material', 13, 'site', 4),
  moduleGuide('doc-tareas', 14, 'site', 3),
  moduleGuide('doc-portal', 15, 'client', 4),
  moduleGuide('doc-firmas', 16, 'client', 4, 's16.note'),
  moduleGuide('doc-movil', 17, 'field', 5),
  moduleGuide('doc-seguridad', 18, 'trust', 5),
];

/** Every string in one section of a locale bundle, flattened into a haystack. */
function sectionText(bundle: Record<string, string>, prefix: string): string {
  return Object.entries(bundle)
    .filter(([k]) => k === prefix || k.startsWith(`${prefix}.`))
    .map(([, v]) => v)
    .join(' ');
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function Docs() {
  const { t, i18n } = useTranslation('docs');
  usePublicPageTitle(t('meta.title'));
  const [query, setQuery] = useState('');
  // Below `lg` the index stacks above the guides; nineteen links would push the
  // first one a screen and a half down, so on a phone it starts folded.
  const [indexOpen, setIndexOpen] = useState(false);

  // Search matches against BOTH locales, so "accounts payable" finds Cuentas
  // por pagar while reading in Spanish and "planilla" finds the time clock
  // while reading in English — without a keyword list to drift out of date.
  const index = useMemo(() => {
    const es = (i18n.getResourceBundle('es', 'docs') ?? {}) as Record<string, string>;
    const en = (i18n.getResourceBundle('en', 'docs') ?? {}) as Record<string, string>;
    return new Map(
      SECTIONS.map((s) => [s.id, `${sectionText(es, s.prefix)} ${sectionText(en, s.prefix)}`.toLowerCase()]),
    );
  }, [i18n]);

  const needle = query.trim().toLowerCase();
  const matches = (s: Section) => needle === '' || (index.get(s.id) ?? '').includes(needle);
  const visible = SECTIONS.filter(matches);
  const noResults = needle !== '' && visible.length === 0;

  const navLinkClass =
    'border-l-2 border-bt-rule py-2 pl-3.5 text-[13.5px] text-bt-brown transition-colors hover:border-bt-orange hover:text-bt-ink';
  const footerLinkClass = 'text-bt-muted-2 transition-colors hover:text-bt-bone';

  return (
    <div className="bt-public flex min-h-[100svh] flex-col bg-bt-paper font-bt-body text-base text-bt-ink">
      <PublicTopbar label={t('topbar.label')} containerClass={CONTAINER}>
        <TopbarLink to="/status">{t('topbar.status')}</TopbarLink>
        <TopbarBackLink to="/">{t('topbar.back')}</TopbarBackLink>
      </PublicTopbar>

      <div
        className={`${CONTAINER} flex w-full flex-1 flex-wrap items-start gap-[clamp(32px,4vw,64px)]`}
      >
        {/* ── Side nav ─────────────────────────────────────────────── */}
        {/* Sticky only once it actually sits beside the guides. Below `lg` the
            column wraps above them, and a pinned sidebar would then float over
            the text it's meant to index. */}
        <aside className="w-[264px] flex-none py-[clamp(32px,4vw,52px)] lg:sticky lg:top-0 lg:max-h-[100svh] lg:overflow-y-auto">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('search.placeholder')}
            aria-label={t('search.placeholder')}
            maxLength={FIELD_LIMITS.SEARCH}
            className="w-full rounded-[2px] border border-bt-rule bg-bt-sheet px-3.5 py-[11px] font-bt-mono text-[11px] tracking-[0.06em] text-bt-ink outline-offset-2 placeholder:text-bt-muted-2"
          />
          {noResults && (
            <p className="mt-3.5 font-bt-mono text-[10px] tracking-[0.1em] text-bt-orange" role="status">
              {t('search.noResults')} «{query.trim().toUpperCase()}»
            </p>
          )}

          <button
            type="button"
            aria-expanded={indexOpen}
            aria-controls="docs-index"
            onClick={() => setIndexOpen((open) => !open)}
            className="mt-[22px] flex w-full items-center justify-between border-b border-bt-rule pb-2.5 font-bt-mono text-[10px] tracking-[0.14em] text-bt-brown lg:hidden"
          >
            {t('nav.index')}
            <span aria-hidden="true">{indexOpen ? '−' : '+'}</span>
          </button>

          <nav id="docs-index" aria-label={t('nav.index')} className={indexOpen ? '' : 'max-lg:hidden'}>
            {NAV_GROUPS.map((group, groupIndex) => (
              <div key={group}>
                <p
                  className={`mb-2.5 font-bt-mono text-[9.5px] tracking-[0.14em] text-bt-muted-2 ${
                    groupIndex === 0 ? 'mt-[26px]' : 'mt-[22px]'
                  }`}
                >
                  {t(`nav.group.${group}`)}
                </p>
                <div className="flex flex-col">
                  {SECTIONS.filter((s) => s.navGroup === group).map((s) => (
                    <a key={s.id} href={`#${s.id}`} onClick={() => setIndexOpen(false)} className={navLinkClass}>
                      {t(s.navKey)}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </nav>

          <div className="mt-[30px] border-t border-bt-rule pt-3.5">
            <p className="font-bt-mono text-[9.5px] leading-[1.7] tracking-[0.1em] text-bt-muted">
              {t('aside.notFound')}
              <br />
              {t('aside.writeUs')}{' '}
              <a href={supportMailto()} className="text-bt-orange">
                {SUPPORT_EMAIL.toUpperCase()}
              </a>
            </p>
          </div>
        </aside>

        {/* ── Guides ───────────────────────────────────────────────── */}
        <main className="min-w-[min(100%,480px)] max-w-[760px] flex-1 py-[clamp(32px,4vw,52px)]">
          <p className="mb-4 font-bt-mono text-[11px] tracking-[0.12em] text-bt-muted">{t('manual')}</p>
          <h1 className="font-bt-heading text-[clamp(30px,3.6vw,46px)] font-bold leading-[1.06] tracking-[-0.015em] text-bt-ink">
            {t('title')}
          </h1>
          <p className="mt-4 max-w-[56ch] text-pretty text-[15.5px] leading-[1.6] text-bt-muted">
            {t('intro')}
          </p>

          {visible.map((section) => (
            <section
              key={section.id}
              id={section.id}
              className="mt-[clamp(40px,5vw,60px)] scroll-mt-6 border-t border-bt-rule pt-7"
            >
              <p className="mb-2.5 font-bt-mono text-[10px] tracking-[0.14em] text-bt-orange">
                {t(`${section.prefix}.code`)}
              </p>
              <h2 className="font-bt-heading text-2xl font-bold tracking-[-0.01em] text-bt-ink">
                {t(`${section.prefix}.title`)}
              </h2>
              <p className="mt-2.5 max-w-[58ch] text-[14.5px] leading-[1.6] text-bt-muted">
                {t(`${section.prefix}.sub`)}
              </p>
              {section.pitch && (
                <p className="mt-3 font-bt-mono text-[10px] leading-[1.7] tracking-[0.1em] text-bt-muted">
                  {t('label.who')} {t(`${section.prefix}.who`)}
                </p>
              )}

              {section.groups.map((group) => (
                <div key={group.keyBase}>
                  {group.labelKey && (
                    <p className="mt-6 font-bt-mono text-[10px] tracking-[0.14em] text-bt-muted">
                      {t(group.labelKey)}
                    </p>
                  )}
                  <div className={`flex flex-col ${group.labelKey ? 'mt-3' : 'mt-5'}`}>
                    {Array.from({ length: group.steps }, (_, i) => i + 1).map((n) => (
                      <div
                        key={n}
                        className={`flex items-start gap-4 border-t border-bt-rule-2 py-[13px] ${
                          n === group.steps ? 'border-b' : ''
                        }`}
                      >
                        <span className="w-[26px] flex-none font-bt-mono text-[11px] text-bt-orange">
                          {pad(n)}
                        </span>
                        <p className="text-[14.5px] leading-[1.6] text-bt-brown">
                          <strong className="font-semibold">{t(`${group.keyBase}.step.${n}.bold`)}</strong>
                          {t(`${group.keyBase}.step.${n}.rest`)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {section.pitch && (
                <div className="mt-5 border-l-2 border-bt-orange bg-bt-sheet px-4 py-3">
                  <p className="font-bt-mono text-[10px] tracking-[0.14em] text-bt-orange">{t('label.gain')}</p>
                  <p className="mt-1.5 text-[14.5px] leading-[1.6] text-bt-ink">{t(`${section.prefix}.gain`)}</p>
                </div>
              )}

              {section.noteKey && (
                <p className="mt-4 font-bt-mono text-[10px] leading-[1.8] tracking-[0.08em] text-bt-muted">
                  {t(section.noteKey)}
                </p>
              )}
            </section>
          ))}

          {/* ── Next step ──────────────────────────────────────────── */}
          {/* Same two doors as the landing — a demo or the beta, both by
              mail with the landing's own subjects so the replies land in the
              same threads. No plan table and no price, as on the rest of the
              public site. */}
          <section
            aria-labelledby="docs-cta-title"
            className="mt-[clamp(40px,5vw,60px)] border-t border-bt-rule pb-[clamp(48px,6vw,80px)] pt-7"
          >
            <p className="mb-2.5 font-bt-mono text-[10px] tracking-[0.14em] text-bt-orange">{t('cta.kicker')}</p>
            <h2
              id="docs-cta-title"
              className="font-bt-heading text-2xl font-bold tracking-[-0.01em] text-bt-ink"
            >
              {t('cta.title')}
            </h2>
            <p className="mt-2.5 max-w-[58ch] text-[14.5px] leading-[1.6] text-bt-muted">{t('cta.body')}</p>
            <div className="mt-6 flex flex-wrap items-center gap-x-[26px] gap-y-4">
              <a
                href={supportMailto(t('cta.demoSubject'))}
                className="inline-block rounded-[2px] bg-bt-orange px-[30px] py-4 text-base font-bold tracking-[-0.01em] text-bt-ink transition-colors hover:bg-bt-orange-hover"
              >
                {t('cta.demo')}
              </a>
              <a
                href={supportMailto(t('cta.betaSubject'))}
                className="border-b border-bt-rule pb-[3px] text-base font-medium text-bt-ink transition-colors hover:border-bt-orange hover:text-bt-orange"
              >
                {t('cta.beta')}
              </a>
            </div>
          </section>
        </main>
      </div>

      <footer className="mt-auto bg-bt-ink">
        <div
          className={`${CONTAINER} flex flex-wrap items-center justify-between gap-3.5 py-[22px] font-bt-mono text-[10px] tracking-[0.1em] text-bt-muted`}
        >
          <span>{t('footer.copy')}</span>
          <span className="flex flex-wrap gap-x-3.5 gap-y-2">
            <Link to="/privacy" className={footerLinkClass}>
              {t('footer.privacy')}
            </Link>
            <span aria-hidden="true">·</span>
            <Link to="/terms" className={footerLinkClass}>
              {t('footer.terms')}
            </Link>
          </span>
          <Link to="/status" className={footerLinkClass}>
            {t('footer.status')}
          </Link>
        </div>
      </footer>
    </div>
  );
}
