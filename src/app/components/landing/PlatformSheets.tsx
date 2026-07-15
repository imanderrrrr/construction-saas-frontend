import { useTranslation } from 'react-i18next';

import { BuildTrackLogo } from './BuildTrackLogo';

/**
 * The three "láminas" (drawing sheets) in the Platform section: BT-01 the
 * overview dashboard, BT-02 accounts payable, BT-03 the daily log.
 *
 * These are mockups, not screenshots — the section copy says so out loud, and
 * the real product footage lives in <DemoVideos /> right below them. They're
 * drawn as construction drawing sheets (sheet-white paper, hairline border,
 * title block along the bottom) rather than browser chrome.
 *
 * Proper nouns, amounts and timestamps are literals on purpose: they read the
 * same in both languages, so only the surrounding copy goes through i18n.
 */

const SHEET = 'bg-bt-sheet border border-[rgba(23,19,15,0.3)]';

/** The bottom strip of a drawing sheet: sheet code on the left, revision right. */
function TitleBlock({ code }: { code: string }) {
  return (
    <div className="flex justify-between gap-2.5 border-t border-[rgba(23,19,15,0.3)] px-3.5 py-[9px] font-bt-mono text-[8.5px] tracking-[0.12em]">
      <span className="text-bt-ink">{code}</span>
      <span className="text-bt-muted-2">REV BETA 0.9</span>
    </div>
  );
}

/* ── BT-01 · Overview dashboard ─────────────────────────────────────────── */

function Kpi({
  label,
  value,
  sub,
  className = '',
}: {
  label: string;
  value: string;
  sub: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="font-bt-mono text-[8.5px] tracking-[0.12em] text-bt-muted">{label}</p>
      <p className="mt-2 font-bt-mono text-[22px] font-semibold text-bt-ink">{value}</p>
      <p className="mt-[5px] text-[10px] text-bt-muted">{sub}</p>
    </div>
  );
}

function PhaseBar({ name, pct, active = false }: { name: string; pct: number; active?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`w-[92px] flex-none text-[11.5px] text-bt-ink ${active ? 'font-semibold' : ''}`}>
        {name}
      </span>
      <span className="relative h-1 flex-1 bg-bt-paper-2">
        <span
          className={`absolute inset-y-0 left-0 block ${active ? 'bg-bt-orange' : 'bg-bt-brown'}`}
          style={{ width: `${pct}%` }}
        />
      </span>
      <span
        className={`w-[34px] text-right font-bt-mono text-[10px] ${active ? 'text-bt-ink' : 'text-bt-muted'}`}
      >
        {pct}%
      </span>
    </div>
  );
}

export function DashboardSheet() {
  const { t } = useTranslation('landing');
  const navItems = [1, 2, 3, 4, 5, 6, 7].map((i) => t(`dash.nav.${i}`));

  return (
    // The sheet keeps a drawing's fixed proportions; on a phone it scrolls
    // sideways rather than reflowing into something that isn't a drawing.
    <div className="overflow-x-auto pb-2">
      <div className={`${SHEET} min-w-[900px] max-w-[1120px] shadow-[0_30px_70px_-38px_rgba(23,19,15,0.45)]`}>
        <div aria-label="BuildTrack dashboard" className="flex min-h-[500px] overflow-hidden">
          {/* Sidebar */}
          <div className="flex w-[208px] flex-none flex-col border-r border-bt-rule-2 bg-bt-paper pb-3.5 pt-4">
            <div className="border-b border-bt-rule-2 px-[18px] pb-3.5 pt-0.5">
              <BuildTrackLogo boxPx={17} textPx={12.5} tone="on-light" />
            </div>
            <div className="px-[18px] pb-2.5 pt-3.5">
              <p className="font-bt-mono text-[8.5px] tracking-[0.12em] text-bt-muted-2">
                {t('dash.activeSite')}
              </p>
              <p className="mt-1.5 text-xs font-semibold leading-[1.3] text-bt-ink">
                Residencial Vista Hermosa
              </p>
              <p className="mt-[3px] font-bt-mono text-[9px] tracking-[0.08em] text-bt-muted">
                {t('dash.zone')}
              </p>
            </div>
            <div className="mt-1.5 flex flex-col">
              {navItems.map((label, i) => (
                <span
                  key={label}
                  className={
                    i === 0
                      ? 'border-l-2 border-bt-orange bg-[#EDE5D6] px-[18px] py-2 text-[12.5px] font-semibold text-bt-ink'
                      : 'border-l-2 border-transparent px-[18px] py-2 text-[12.5px] text-bt-muted'
                  }
                >
                  {label}
                </span>
              ))}
            </div>
            <div className="mt-auto border-t border-bt-rule-2 px-[18px] pt-3">
              <p className="text-[11px] font-semibold text-bt-ink">J. Ramírez</p>
              <p className="mt-0.5 font-bt-mono text-[8.5px] tracking-[0.1em] text-bt-muted-2">
                {t('dash.role')}
              </p>
            </div>
          </div>

          {/* Main */}
          <div className="flex min-w-0 flex-1 flex-col gap-5 bg-bt-sheet px-[26px] pb-6 pt-5">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <p className="text-[15px] font-bold tracking-[-0.01em] text-bt-ink">{t('dash.title')}</p>
              <p className="font-bt-mono text-[9.5px] tracking-[0.1em] text-bt-muted-2">
                {t('dash.updated')}
              </p>
            </div>

            <div className="grid grid-cols-4 border-y border-bt-rule-2">
              <Kpi
                label={t('dash.k1')}
                value="62%"
                sub={t('dash.k1sub')}
                className="border-r border-bt-rule-2 py-3.5 pb-4 pr-4"
              />
              <Kpi
                label={t('dash.k2')}
                value="$1.82M"
                sub={t('dash.k2sub')}
                className="border-r border-bt-rule-2 px-4 py-3.5 pb-4"
              />
              <Kpi
                label={t('dash.k3')}
                value="$310,400"
                sub={t('dash.k3sub')}
                className="border-r border-bt-rule-2 px-4 py-3.5 pb-4"
              />
              <Kpi label={t('dash.k4')} value="34" sub={t('dash.k4sub')} className="py-3.5 pb-4 pl-4" />
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-[1.1fr_1fr] gap-7">
              {/* Phases */}
              <div>
                <p className="mb-3.5 font-bt-mono text-[8.5px] tracking-[0.12em] text-bt-muted">
                  {t('dash.phases')}
                </p>
                <div className="flex flex-col gap-[13px]">
                  <PhaseBar name={t('dash.phase.1')} pct={100} />
                  <PhaseBar name={t('dash.phase.2')} pct={78} active />
                  <PhaseBar name={t('dash.phase.3')} pct={41} />
                  <PhaseBar name={t('dash.phase.4')} pct={12} />
                </div>
                <div className="mt-5 flex flex-wrap justify-between gap-2.5 border-t border-bt-rule-2 pt-3">
                  <p className="font-bt-mono text-[9px] tracking-[0.1em] text-bt-orange">
                    {t('dash.inProgress')}
                  </p>
                  <p className="font-bt-mono text-[9px] tracking-[0.1em] text-bt-muted-2">
                    {t('dash.delivery')}
                  </p>
                </div>
              </div>

              {/* Daily log */}
              <div className="border-l border-bt-rule-2 pl-6">
                <p className="mb-3.5 font-bt-mono text-[8.5px] tracking-[0.12em] text-bt-muted">
                  {t('dash.log')}
                </p>
                <div className="flex flex-col gap-3.5">
                  <div className="flex items-start gap-3">
                    <span className="flex-none pt-0.5 font-bt-mono text-[9.5px] text-bt-muted-2">07:12</span>
                    <div className="min-w-0">
                      <p className="text-[11.5px] leading-[1.45] text-bt-ink">{t('dash.log.1')}</p>
                      <div className="mt-[7px] flex gap-[5px]">
                        <span className="block h-[26px] w-[26px] border border-bt-rule bg-bt-paper-2" />
                        <span className="block h-[26px] w-[26px] border border-bt-rule bg-[#DED4C2]" />
                        <span className="block h-[26px] w-[26px] border border-bt-rule bg-bt-paper-2" />
                        <span className="self-center pl-[3px] font-bt-mono text-[9px] text-bt-muted">
                          {t('dash.log.1photos')}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 border-t border-bt-rule-3 pt-3.5">
                    <span className="flex-none pt-0.5 font-bt-mono text-[9.5px] text-bt-muted-2">09:40</span>
                    <p className="min-w-0 text-[11.5px] leading-[1.45] text-bt-ink">{t('dash.log.2')}</p>
                  </div>
                  <div className="flex items-start gap-3 border-t border-bt-rule-3 pt-3.5">
                    <span className="flex-none pt-0.5 font-bt-mono text-[9.5px] text-bt-muted-2">11:05</span>
                    <div className="min-w-0">
                      <p className="text-[11.5px] leading-[1.45] text-bt-ink">{t('dash.log.3')}</p>
                      <p className="mt-[5px] font-bt-mono text-[9px] tracking-[0.08em] text-bt-orange">
                        {t('dash.log.3status')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Title block — the 1px gaps in the grid draw the dividers */}
        <div className="grid grid-cols-[2fr_1.5fr_0.8fr_0.8fr] gap-px border-t border-[rgba(23,19,15,0.3)] bg-[rgba(23,19,15,0.3)]">
          {(
            [
              [t('titleblock.project'), t('titleblock.projectValue')],
              [t('titleblock.sheet'), t('titleblock.sheetValue')],
              ['REV', 'BETA 0.9'],
              [t('titleblock.date'), '07 · 2026'],
            ] as [string, string][]
          ).map(([label, value]) => (
            <div key={label} className="bg-bt-sheet px-4 py-2.5">
              <p className="font-bt-mono text-[8px] tracking-[0.14em] text-bt-muted-2">{label}</p>
              <p className="mt-1 font-bt-mono text-[10px] text-bt-ink">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── BT-02 · Accounts payable ───────────────────────────────────────────── */

function PayableRow({
  vendor,
  detail,
  amount,
  state,
  stateTone = 'muted',
}: {
  vendor: string;
  detail: string;
  amount: string;
  state: string;
  stateTone?: 'orange' | 'muted' | 'faint';
}) {
  const tone =
    stateTone === 'orange' ? 'text-bt-orange' : stateTone === 'muted' ? 'text-bt-muted' : 'text-bt-muted-2';
  return (
    <div className="flex items-start justify-between gap-3 border-b border-bt-rule-3 py-[11px]">
      <div className="min-w-0">
        <p className="text-[11.5px] font-semibold text-bt-ink">{vendor}</p>
        <p className="mt-0.5 text-[10px] text-bt-muted">{detail}</p>
      </div>
      <div className="flex-none text-right">
        <p className="font-bt-mono text-[11px] text-bt-ink">{amount}</p>
        <p className={`mt-[3px] font-bt-mono text-[8px] tracking-[0.1em] ${tone}`}>{state}</p>
      </div>
    </div>
  );
}

export function PayablesSheet() {
  const { t } = useTranslation('landing');
  return (
    <div className={`${SHEET} flex flex-col shadow-[0_22px_50px_-32px_rgba(23,19,15,0.4)]`}>
      <div className="flex min-h-[340px] flex-1 flex-col px-5 pb-4 pt-[18px]">
        <div className="mb-3.5 flex items-baseline justify-between gap-2.5">
          <p className="text-[13px] font-bold text-bt-ink">{t('sheet2.title')}</p>
          <p className="font-bt-mono text-[8.5px] tracking-[0.1em] text-bt-muted-2">{t('sheet2.week')}</p>
        </div>
        <div className="border-t border-bt-rule-2">
          <PayableRow
            vendor="Cementos Progreso"
            detail={t('sheet2.row1')}
            amount="$48,600"
            state={t('sheet2.state1')}
            stateTone="orange"
          />
          <PayableRow
            vendor="Aceros de Guatemala"
            detail={t('sheet2.row2')}
            amount="$61,250"
            state={t('sheet2.state2')}
          />
          <PayableRow
            vendor={t('sheet2.row3title')}
            detail={t('sheet2.row3')}
            amount="$52,400"
            state={t('sheet2.state3')}
            stateTone="faint"
          />
          <PayableRow
            vendor="Ferretería El Cantero"
            detail={t('sheet2.row4')}
            amount="$7,830"
            state={t('sheet2.state3')}
            stateTone="faint"
          />
        </div>
        <div className="mt-auto flex items-baseline justify-between gap-2.5 pt-3.5">
          <p className="font-bt-mono text-[8.5px] tracking-[0.12em] text-bt-muted">{t('sheet2.total')}</p>
          <p className="font-bt-mono text-[15px] font-semibold text-bt-ink">$109,850</p>
        </div>
      </div>
      <TitleBlock code={t('sheet2.titleblock')} />
    </div>
  );
}

/* ── BT-03 · Daily log ──────────────────────────────────────────────────── */

export function DailyLogSheet() {
  const { t } = useTranslation('landing');
  return (
    <div className={`${SHEET} flex flex-col shadow-[0_22px_50px_-32px_rgba(23,19,15,0.4)]`}>
      <div className="flex min-h-[340px] flex-1 flex-col px-5 pb-4 pt-[18px]">
        <div className="mb-3.5 flex items-baseline justify-between gap-2.5">
          <p className="text-[13px] font-bold text-bt-ink">{t('sheet3.title')}</p>
          <p className="font-bt-mono text-[8.5px] tracking-[0.1em] text-bt-muted-2">{t('sheet3.date')}</p>
        </div>
        <div className="border-t border-bt-rule-2 pt-3">
          <div className="flex items-start gap-2.5">
            <span className="flex-none pt-0.5 font-bt-mono text-[9px] text-bt-muted-2">06:40</span>
            <div className="min-w-0">
              <p className="text-[11.5px] leading-[1.45] text-bt-ink">{t('sheet3.row1')}</p>
              <div className="mt-2 flex gap-[5px]">
                <span className="block h-[42px] w-[42px] border border-bt-rule bg-[#DED4C2]" />
                <span className="block h-[42px] w-[42px] border border-bt-rule bg-[#CBBFA8]" />
                <span className="block h-[42px] w-[42px] border border-bt-rule bg-bt-paper-2" />
                <span className="flex h-[42px] w-[42px] items-center justify-center border border-bt-rule bg-[#D5C9B4] font-bt-mono text-[8.5px] text-bt-brown">
                  +14
                </span>
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-start gap-2.5 border-t border-bt-rule-3 pt-3">
            <span className="flex-none pt-0.5 font-bt-mono text-[9px] text-bt-muted-2">10:15</span>
            <p className="min-w-0 text-[11.5px] leading-[1.45] text-bt-ink">{t('sheet3.row2')}</p>
          </div>
          <div className="mt-3 flex items-start gap-2.5 border-t border-bt-rule-3 pt-3">
            <span className="flex-none pt-0.5 font-bt-mono text-[9px] text-bt-muted-2">13:20</span>
            <div className="min-w-0">
              <p className="text-[11.5px] leading-[1.45] text-bt-ink">{t('sheet3.row3')}</p>
              <p className="mt-1 font-bt-mono text-[8px] tracking-[0.1em] text-bt-muted">
                {t('sheet3.weather')}
              </p>
            </div>
          </div>
        </div>
        <div className="mt-auto flex justify-between gap-2.5 border-t border-bt-rule-2 pt-3.5">
          <p className="font-bt-mono text-[8.5px] tracking-[0.1em] text-bt-muted">{t('sheet3.signature')}</p>
          <p className="font-bt-mono text-[8.5px] tracking-[0.1em] text-bt-orange">{t('sheet3.signed')}</p>
        </div>
      </div>
      <TitleBlock code={t('sheet3.titleblock')} />
    </div>
  );
}
