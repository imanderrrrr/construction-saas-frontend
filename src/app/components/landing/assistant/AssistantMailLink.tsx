import { SUPPORT_EMAIL, supportMailto } from '../../../lib/contact';

/**
 * The support inbox as a full-width, 44 px tall mail link — the way out the
 * assistant offers whenever it cannot help (chat off, limit reached, panel not
 * loadable). Shared by the launcher's fallback and the panel's notices, so it
 * stays small: it ships with the landing.
 */
export function AssistantMailLink() {
  return (
    <a
      href={supportMailto()}
      className="flex min-h-11 items-center gap-2.5 rounded-[2px] border border-bt-ink bg-bt-sheet px-3 font-bt-mono text-[12.5px] tracking-[0.02em] text-bt-ink"
    >
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" className="flex-none">
        <path d="M2 4 H16 V14 H2 Z M2 4 L9 10 L16 4" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
      <span className="min-w-0 break-all">{SUPPORT_EMAIL}</span>
    </a>
  );
}
