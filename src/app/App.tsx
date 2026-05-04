import { useEffect, useState } from 'react';
import { RouterProvider } from 'react-router';
import { router } from './routes';
import { AuthService } from './services/auth';
import { IntroOverlay } from './components/IntroOverlay';
import { getBaseUrl, isAuthenticated } from './lib/api';

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
    return (
      <>
        <IntroOverlay />
        <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-3 border-[#F97316] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-[#71717A]">Loading…</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <IntroOverlay />
      <RouterProvider router={router} />
    </>
  );
}
