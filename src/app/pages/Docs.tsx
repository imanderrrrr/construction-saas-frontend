import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PublicTopbar, TopbarBackLink, TopbarLink } from '../components/landing/PublicTopbar';
import { BETA_EMAIL } from '../components/landing/contact';
import { usePublicPageTitle } from '../hooks/usePublicPageTitle';
import { FIELD_LIMITS } from '../../shared/fieldLimits';

/**
 * Public documentation — one short guide per module, in the order they're used
 * on site.
 *
 * Ported from the Claude Design sheet "BuildTrack Docs". The copy deliberately
 * describes only what the system does today; if a step isn't in the product,
 * it isn't in here.
 */

const CONTAINER = 'mx-auto max-w-[1400px] px-[clamp(22px,5vw,64px)]';

type Group = {
  /** Key prefix for this group's steps, e.g. `s2.a` → `s2.a.step.1.bold`. */
  keyBase: string;
  labelKey?: string;
  steps: number;
};

type Section = {
  /** Anchor id, also the search-index key. */
  id: string;
  /** Key prefix covering every string in the section. */
  prefix: string;
  navKey: string;
  groups: Group[];
  noteKey?: string;
};

const SECTIONS: Section[] = [
  { id: 'primeros-pasos', prefix: 's0', navKey: 'nav.start', groups: [{ keyBase: 's0', steps: 4 }], noteKey: 's0.note' },
  { id: 'doc-proyectos', prefix: 's1', navKey: 'nav.1', groups: [{ keyBase: 's1', steps: 5 }], noteKey: 's1.note' },
  {
    id: 'doc-finanzas',
    prefix: 's2',
    navKey: 'nav.2',
    groups: [
      { keyBase: 's2.a', labelKey: 's2.a.label', steps: 4 },
      { keyBase: 's2.b', labelKey: 's2.b.label', steps: 1 },
      { keyBase: 's2.c', labelKey: 's2.c.label', steps: 2 },
      { keyBase: 's2.d', labelKey: 's2.d.label', steps: 1 },
    ],
  },
  { id: 'doc-bitacora', prefix: 's3', navKey: 'nav.3', groups: [{ keyBase: 's3', steps: 4 }] },
  { id: 'doc-rfi', prefix: 's4', navKey: 'nav.4', groups: [{ keyBase: 's4', steps: 4 }], noteKey: 's4.note' },
  { id: 'doc-portal', prefix: 's5', navKey: 'nav.5', groups: [{ keyBase: 's5', steps: 3 }] },
  { id: 'doc-movil', prefix: 's6', navKey: 'nav.6', groups: [{ keyBase: 's6', steps: 4 }] },
];

const MODULE_SECTIONS = SECTIONS.slice(1);

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

  // Search matches against BOTH locales, so "accounts payable" finds Finanzas
  // while reading in Spanish and "planilla" finds Payroll while reading in
  // English — without a hand-maintained keyword list to drift out of date.
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

          <p className="mb-2.5 mt-[26px] font-bt-mono text-[9.5px] tracking-[0.14em] text-bt-muted-2">
            {t('nav.group.start')}
          </p>
          <div className="flex flex-col">
            <a href="#primeros-pasos" className={navLinkClass}>
              {t('nav.start')}
            </a>
          </div>

          <p className="mb-2.5 mt-[22px] font-bt-mono text-[9.5px] tracking-[0.14em] text-bt-muted-2">
            {t('nav.group.modules')}
          </p>
          <div className="flex flex-col">
            {MODULE_SECTIONS.map((s) => (
              <a key={s.id} href={`#${s.id}`} className={navLinkClass}>
                {t(s.navKey)}
              </a>
            ))}
          </div>

          <div className="mt-[30px] border-t border-bt-rule pt-3.5">
            <p className="font-bt-mono text-[9.5px] leading-[1.7] tracking-[0.1em] text-bt-muted">
              {t('aside.notFound')}
              <br />
              {t('aside.writeUs')}{' '}
              <a href={`mailto:${BETA_EMAIL}`} className="text-bt-orange">
                {BETA_EMAIL.toUpperCase()}
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

          {visible.map((section, sectionIndex) => (
            <section
              key={section.id}
              id={section.id}
              className={`mt-[clamp(40px,5vw,60px)] scroll-mt-6 border-t border-bt-rule pt-7 ${
                sectionIndex === visible.length - 1 ? 'pb-[clamp(48px,6vw,80px)]' : ''
              }`}
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

              {section.noteKey && (
                <p className="mt-4 font-bt-mono text-[10px] leading-[1.8] tracking-[0.08em] text-bt-muted">
                  {t(section.noteKey)}
                </p>
              )}
            </section>
          ))}
        </main>
      </div>

      <footer className="mt-auto bg-bt-ink">
        <div
          className={`${CONTAINER} flex flex-wrap justify-between gap-3.5 py-[22px] font-bt-mono text-[10px] tracking-[0.1em] text-bt-muted`}
        >
          <span>{t('footer.copy')}</span>
          <TopbarLink to="/status">{t('footer.status')}</TopbarLink>
        </div>
      </footer>
    </div>
  );
}
