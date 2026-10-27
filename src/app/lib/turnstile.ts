// BuildTrack — Cloudflare Turnstile loader (landing assistant only).
//
// Turnstile proves a human before the landing assistant opens a conversation
// or sends a contact; the backend verifies the token with its secret key.
//
// Design notes:
//   - The script is loaded ON DEMAND, the first time the visitor opens the
//     assistant, so the landing never pays for it. The promise is memoised so
//     concurrent calls share one load; a failed load is forgotten so the next
//     call tries again (an ad blocker today may be switched off tomorrow).
//   - `VITE_TURNSTILE_SITE_KEY` is the PUBLIC site key. Without it nothing is
//     loaded and every call rejects with TurnstileUnavailableError: the widget
//     falls back to the support email.
//   - The widget renders with `appearance: 'interaction-only'`: invisible
//     unless Cloudflare decides it needs the visitor to click, which is when
//     `onInteractive` tells the caller to make room for it.
//   - We type `window.turnstile` minimally — only the surface this app uses.

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

interface TurnstileRenderOptions {
  sitekey: string;
  appearance: 'always' | 'execute' | 'interaction-only';
  size: 'normal' | 'compact' | 'flexible';
  theme: 'auto' | 'light' | 'dark';
  retry: 'auto' | 'never';
  callback: (token: string) => void;
  'error-callback': (code?: string) => void;
  'timeout-callback': () => void;
  'before-interactive-callback': () => void;
}

interface TurnstileGlobal {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string | undefined;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileGlobal;
  }
}

/** No site key, the script did not load, or it loaded without its global. The chat cannot start. */
export class TurnstileUnavailableError extends Error {
  constructor(message = 'Turnstile is unavailable') {
    super(message);
    this.name = 'TurnstileUnavailableError';
  }
}

/** The challenge ran and did not vouch for the visitor (or timed out waiting for a click). */
export class TurnstileFailedError extends Error {
  constructor(message = 'Turnstile challenge failed') {
    super(message);
    this.name = 'TurnstileFailedError';
  }
}

/**
 * How long a challenge may stay silent before it counts as failed. An invisible
 * challenge normally answers in a few seconds; one whose frames a proxy blocks
 * never answers at all, and the chat would sit on "typing" forever. Once the
 * challenge asks the visitor to click, Turnstile's own timeout takes over.
 */
export const TURNSTILE_DEADLINE_MS = 30_000;

let scriptPromise: Promise<TurnstileGlobal> | null = null;

function siteKey(): string {
  const raw = import.meta.env.VITE_TURNSTILE_SITE_KEY;
  return typeof raw === 'string' ? raw.trim() : '';
}

/** True when the build carries a site key. Without one the assistant only offers the support email. */
export function isTurnstileConfigured(): boolean {
  return siteKey() !== '';
}

function loadScript(): Promise<TurnstileGlobal> {
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<TurnstileGlobal>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => {
      if (window.turnstile) resolve(window.turnstile);
      else reject(new TurnstileUnavailableError('Turnstile loaded but window.turnstile is undefined'));
    };
    script.onerror = () => {
      // Drop the dead tag so a retry starts clean instead of waiting on it.
      script.remove();
      reject(new TurnstileUnavailableError('Failed to load Turnstile'));
    };
    document.head.appendChild(script);
  });

  scriptPromise.catch(() => {
    scriptPromise = null;
  });

  return scriptPromise;
}

/**
 * Render an invisible Turnstile widget in [container] and resolve with its token.
 * The widget is removed once it answers, either way: a token is single-use, so
 * every conversation start and every contact submission asks for a new one.
 */
export async function requestTurnstileToken(
  container: HTMLElement,
  hooks?: { onInteractive?: () => void },
): Promise<string> {
  const key = siteKey();
  if (!key) throw new TurnstileUnavailableError('VITE_TURNSTILE_SITE_KEY is not set');

  const turnstile = await loadScript();

  return new Promise<string>((resolve, reject) => {
    let widgetId: string | undefined;
    const deadline = setTimeout(() => {
      done();
      reject(new TurnstileFailedError('Turnstile challenge did not answer'));
    }, TURNSTILE_DEADLINE_MS);
    function done() {
      clearTimeout(deadline);
      if (widgetId !== undefined) turnstile.remove(widgetId);
    }
    try {
      widgetId = turnstile.render(container, {
        sitekey: key,
        appearance: 'interaction-only',
        size: 'flexible',
        // The card it shows in is light whatever the visitor's system theme.
        theme: 'light',
        // Every answer removes the widget; Turnstile's own retry would then
        // try to reset a widget that is gone and throw "Nothing to reset".
        retry: 'never',
        callback: (token) => {
          done();
          resolve(token);
        },
        'error-callback': () => {
          done();
          reject(new TurnstileFailedError());
        },
        'timeout-callback': () => {
          done();
          reject(new TurnstileFailedError('Turnstile challenge timed out'));
        },
        'before-interactive-callback': () => {
          clearTimeout(deadline);
          hooks?.onInteractive?.();
        },
      });
    } catch {
      done();
      reject(new TurnstileUnavailableError('Turnstile could not render'));
      return;
    }
    // Cloudflare returns no id when the invocation failed: no callback will ever come.
    if (widgetId === undefined) {
      done();
      reject(new TurnstileUnavailableError('Turnstile did not render a widget'));
    }
  });
}
