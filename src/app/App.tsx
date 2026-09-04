import { useEffect, useState } from 'react';
import { RouterProvider } from 'react-router';
import { router } from './routes';
import { AuthService } from './services/auth';
import { IntroOverlay } from './components/IntroOverlay';
import { Splash, WelcomeOverlay } from './components/WelcomeOverlay';
import { ErrorFallback } from './components/ErrorFallback';
import { getBaseUrl, isAuthenticated } from './lib/api';
import { SentryErrorBoundary } from './lib/sentry';

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const validate = async () => {
      if (!isAuthenticated()) {
        setReady(true);
        return;
      }
      try {
        // Validate session directly with a short timeout.
        // We bypass the api() wrapper to avoid the auto-refresh redirect loop
        // that can hang on cold starts.
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        const res = await fetch(`${getBaseUrl()}/api/v1/auth/me`, {
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!res.ok) {
          // Token is invalid — clear and proceed to login
          await AuthService.logout();
        }
      } catch {
        // Timeout, network error, or any other issue — clear and proceed.
        await AuthService.logout();
      }
      setReady(true);
    };
    validate();
  }, []);

  if (!ready) {
    // A reload with an open session: the splash (the welcome without its
    // greeting) instead of a spinner — a reload is not a sign-in.
    return (
      <>
        <IntroOverlay />
        <Splash />
      </>
    );
  }

  return (
    <>
      <IntroOverlay />
      <WelcomeOverlay />
      {/* SentryErrorBoundary catches uncaught render-time errors anywhere
          in the route tree. The fallback never throws and is render-only,
          so it cannot trigger a second-level error loop. When Sentry is
          not initialised (no DSN) the boundary still works as a plain
          React error boundary — only the network capture is skipped. */}
      <SentryErrorBoundary
        fallback={({ error, resetError }) => (
          <ErrorFallback error={error} resetError={resetError} />
        )}
      >
        <RouterProvider router={router} />
      </SentryErrorBoundary>
    </>
  );
}
