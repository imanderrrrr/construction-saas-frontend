// BuildTrack — Paddle.js loader (admin-side billing only).
//
// Wraps the official Paddle Billing v2 client SDK so the rest of the app
// can call `openCheckout({ transactionId, ... })` without worrying about
// script loading, environment selection, or initialisation.
//
// Design notes:
//   - The SDK is loaded ON DEMAND (the first time anyone calls getPaddle())
//     so the public landing never pays for it. The promise is memoised so
//     repeat calls reuse the same in-flight load.
//   - `VITE_PADDLE_ENVIRONMENT` defaults to "sandbox". Anything other than
//     the literal string "production" stays in sandbox — this is a hard
//     rule so a typo or missing env never escalates to live billing.
//   - The frontend does NOT mint transactions. The backend resolves the
//     priceId / currency / trial from `planCode + billingInterval` and
//     returns a `transactionId`. Frontend only opens the overlay against
//     that id. There is no path here that takes prices or amounts.
//   - We type `window.Paddle` minimally — only the surface this app uses.

const SCRIPT_SRC = 'https://cdn.paddle.com/paddle/v2/paddle.js';

type PaddleEnvironment = 'sandbox' | 'production';

interface PaddleCheckoutSettings {
  successUrl?: string;
  // Paddle's overlay supports more knobs (theme, locale, displayMode,
  // allowLogout, etc.) — we only forward what we actually use today and
  // can extend the type as we wire more options in.
  displayMode?: 'overlay' | 'inline';
  theme?: 'light' | 'dark';
  locale?: string;
}

interface PaddleCheckoutOpenOptions {
  transactionId: string;
  settings?: PaddleCheckoutSettings;
  // `customer.email` is the only customer field Paddle Checkout v2 needs
  // when transaction is already created server-side (rest comes from the
  // transaction). We expose it so admins can pre-fill if we want.
  customer?: { email?: string };
}

interface PaddleGlobal {
  Environment: { set: (env: PaddleEnvironment) => void };
  Initialize: (opts: {
    token: string;
    eventCallback?: (event: { name: string; data?: unknown }) => void;
  }) => void;
  Checkout: {
    open: (opts: PaddleCheckoutOpenOptions) => void;
    close: () => void;
  };
}

declare global {
  interface Window {
    Paddle?: PaddleGlobal;
  }
}

// Memoised SDK promise — first caller triggers the load, the rest await
// the same promise.
let paddlePromise: Promise<PaddleGlobal> | null = null;

function readEnvironment(): PaddleEnvironment {
  // Anything that isn't the exact literal "production" stays sandbox.
  // This is intentional: missing/empty/typo all collapse to safe.
  const raw = import.meta.env.VITE_PADDLE_ENVIRONMENT;
  return raw === 'production' ? 'production' : 'sandbox';
}

function readClientToken(): string {
  const token = import.meta.env.VITE_PADDLE_CLIENT_TOKEN;
  if (!token || typeof token !== 'string' || token.trim() === '') {
    throw new Error(
      'VITE_PADDLE_CLIENT_TOKEN is not set. Add it to your .env (or hosting ' +
        'provider env) before opening Paddle Checkout. See .env.example.',
    );
  }
  return token.trim();
}

function injectScript(): Promise<void> {
  // SSR / non-browser guard — billing is desktop/web only but we keep the
  // check so unit tests in jsdom don't blow up importing this module.
  if (typeof document === 'undefined') {
    return Promise.reject(new Error('Paddle.js cannot load outside a browser.'));
  }

  // If a previous attempt already injected the tag, wait for it instead of
  // adding a duplicate.
  const existing = document.querySelector<HTMLScriptElement>(
    `script[src="${SCRIPT_SRC}"]`,
  );
  if (existing) {
    if (window.Paddle) return Promise.resolve();
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () =>
        reject(new Error('Failed to load Paddle.js')),
      );
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Paddle.js'));
    document.head.appendChild(script);
  });
}

/**
 * Resolve the initialised Paddle SDK. Throws a clear error if the client
 * token is missing or the script fails to load.
 *
 * Safe to call repeatedly — load + init only run once.
 */
export async function getPaddle(): Promise<PaddleGlobal> {
  if (paddlePromise) return paddlePromise;

  paddlePromise = (async () => {
    const token = readClientToken();
    const environment = readEnvironment();

    await injectScript();

    const paddle = window.Paddle;
    if (!paddle) {
      throw new Error('Paddle.js loaded but window.Paddle is undefined.');
    }

    // Environment must be set BEFORE Initialize per Paddle docs; setting it
    // after has no effect on overlay routing.
    paddle.Environment.set(environment);
    paddle.Initialize({ token });

    return paddle;
  })();

  // If init fails we don't want the failed promise sticking around forever
  // — clear so the next attempt re-tries from scratch.
  paddlePromise.catch(() => {
    paddlePromise = null;
  });

  return paddlePromise;
}

/**
 * Open Paddle Checkout for a transaction the backend already created.
 * The frontend never knows the price; it only forwards the id.
 */
export async function openCheckout(
  options: PaddleCheckoutOpenOptions,
): Promise<void> {
  const paddle = await getPaddle();
  paddle.Checkout.open(options);
}

// Re-exports so callers can use the types without re-deriving them.
export type {
  PaddleEnvironment,
  PaddleCheckoutSettings,
  PaddleCheckoutOpenOptions,
};
