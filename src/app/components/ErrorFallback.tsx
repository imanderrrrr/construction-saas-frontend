// Fallback UI shown when Sentry's ErrorBoundary catches an unhandled
// render error. Visual style matches the loading screen in App.tsx so it
// feels native to the app rather than a stack-trace dump.
//
// Intentionally minimal: no router dependency (the boundary may catch a
// router error itself), no i18n (the i18n bundle may have failed to load),
// no API calls. Plain HTML + Tailwind only.

import { Sentry } from '../lib/sentry';

interface Props {
  error: unknown;
  resetError: () => void;
}

export function ErrorFallback({ error, resetError }: Props) {
  // Surface the Sentry event id so a user can quote it to support.
  // lastEventId() is null when Sentry isn't initialised, in which case we
  // simply hide the line.
  const eventId = Sentry.lastEventId?.();

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-[#FEE2E2] flex items-center justify-center mb-4">
          <span className="text-[#DC2626] text-2xl leading-none">!</span>
        </div>
        <h1 className="text-lg font-semibold text-[#0A0A0A] mb-2">
          Something went wrong
        </h1>
        <p className="text-sm text-[#71717A] mb-6">
          The page hit an unexpected error. Try reloading. If it keeps
          happening, please contact support.
        </p>
        {eventId ? (
          <p className="text-xs text-[#A1A1AA] mb-6 break-all">
            Reference id: <span className="font-mono">{eventId}</span>
          </p>
        ) : null}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => {
              resetError();
              window.location.reload();
            }}
            className="bg-[#F97316] text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-[#EA580C] transition-colors"
          >
            Reload the page
          </button>
          <button
            type="button"
            onClick={() => {
              window.location.href = '/';
            }}
            className="text-[#71717A] text-sm font-medium px-4 py-2 rounded-md hover:bg-[#F4F4F5] transition-colors"
          >
            Go to home
          </button>
        </div>
        {import.meta.env.DEV && error instanceof Error ? (
          <pre className="mt-6 text-left text-xs text-[#71717A] bg-[#F4F4F5] p-3 rounded-md overflow-auto max-h-40">
            {error.message}
          </pre>
        ) : null}
      </div>
    </div>
  );
}
