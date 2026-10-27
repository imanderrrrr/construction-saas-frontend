// Class recipes of the landing assistant, from the approved design
// (docs/superpowers/specs/2026-10-25-asistente-landing-ui.md §3). One place, so
// the chat, the form and the notices draw the same sheet.

/** Mono micro-label: turn labels, field labels, notice labels. */
export const MICRO_LABEL = 'font-bt-mono text-[10px] font-medium uppercase tracking-[0.12em] text-bt-muted';

/** The orange that reads as text on light paper (`T-01`, `P-01`, `AVISO`). */
export const CODE = 'text-bt-orange-ink';

export const BOT_CARD = 'border border-[rgba(23,19,15,0.3)] bg-bt-sheet px-3.5 py-[11px] text-sm leading-[1.55] text-bt-ink';

export const VISITOR_CARD = 'max-w-[88%] self-end bg-bt-ink px-3.5 py-[11px] text-sm leading-[1.5] text-bt-bone';

/** Notice card; the top rule is orange for information and red for a failure. */
export const NOTICE =
  'border border-[rgba(23,19,15,0.3)] border-t-[3px] bg-bt-sheet px-3.5 pb-3.5 pt-2.5 text-[13px] leading-normal text-bt-brown';

/**
 * Focus on light surfaces: an ink ring with an orange halo (orange alone is
 * 2.4:1 on paper). `!` because the public pages' `.bt-public :focus-visible`
 * rule is unlayered and would otherwise win over any utility.
 */
export const FOCUS_ON_LIGHT =
  'focus-visible:outline-2! focus-visible:outline-offset-2! focus-visible:outline-bt-ink! focus-visible:shadow-[0_0_0_5px_rgba(249,115,22,0.55)]';

const BUTTON = 'inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-[2px] px-3.5 text-sm whitespace-nowrap';

export const BUTTON_PRIMARY = `${BUTTON} bg-bt-orange font-bold text-bt-ink hover:bg-bt-orange-hover ${FOCUS_ON_LIGHT}`;

export const BUTTON_SECONDARY = `${BUTTON} border border-bt-ink font-semibold text-bt-ink hover:bg-bt-paper ${FOCUS_ON_LIGHT}`;

/** The strip under the body that holds the sheet's buttons. */
export const ACTION_STRIP = 'flex flex-none gap-2 border-t border-[rgba(23,19,15,0.3)] bg-bt-sheet px-3 py-2';

/** The paper body of every view, with the 52 px blueprint grid at 5 % ink. */
export const BODY = 'flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-bt-paper p-4';

export const BODY_GRID = {
  backgroundImage:
    'linear-gradient(to right, rgba(23,19,15,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(23,19,15,0.05) 1px, transparent 1px)',
  backgroundSize: '52px 52px',
} as const;

/** Two-digit sheet number: `T-01`, `P-03`, `TURNO 07/10`. */
export function sheetNumber(n: number): string {
  return String(n).padStart(2, '0');
}
