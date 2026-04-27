// AuthHandoff — receives session tokens from the mobile app via URL fragment
// (hash), sends them to the backend handoff endpoint which sets HttpOnly cookies,
// then redirects to the role-appropriate dashboard.

import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { getBaseUrl } from '../lib/api';
import { AuthService } from '../services/auth';
import { Building2, Loader2 } from 'lucide-react';

function parseFragment(): URLSearchParams {
  const hash = window.location.hash.slice(1); // remove leading '#'
  return new URLSearchParams(hash);
}

export function AuthHandoff() {
  const navigate = useNavigate();

  useEffect(() => {
    const fragment = parseFragment();
    const token = fragment.get('token');
    // refreshToken is optional — the backend generates a new one server-side
    // when not provided. Mobile clients omit it to avoid URL exposure.
    const refreshToken = fragment.get('refreshToken');

    // Clear the fragment from the address bar so tokens are not visible
    // if the user copies/shares the URL or it remains in browser history.
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname);
    }

    if (!token) {
      // No token provided — go to normal login.
      navigate('/', { replace: true });
      return;
    }

    // Send tokens to the backend handoff endpoint which sets HttpOnly cookies.
    (async () => {
      try {
        const res = await fetch(`${getBaseUrl()}/api/v1/auth/handoff`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(
          refreshToken ? { token, refreshToken } : { token },
        ),
        });

        if (!res.ok) throw new Error('Handoff failed');

        const data = await res.json();
        const dashRoute = AuthService.getDashboardRoute(data.role);
        navigate(dashRoute, { replace: true });
      } catch {
        // Token might be invalid — fall back to login.
        await AuthService.logout();
        navigate('/', { replace: true });
      }
    })();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FAFAFA] to-[#D4D4D8] flex flex-col items-center justify-center px-4">
      <div className="inline-flex items-center justify-center w-16 h-16 bg-[#F97316] rounded-xl mb-6 shadow-lg shadow-[#F97316]/25">
        <Building2 className="w-8 h-8 text-white" />
      </div>
      <h1 className="text-2xl font-bold text-[#0A0A0A] mb-2">BuildTrack</h1>
      <div className="flex items-center gap-2 mt-4">
        <Loader2 className="w-5 h-5 text-[#F97316] animate-spin" />
        <p className="text-sm text-[#71717A]">Iniciando sesión...</p>
      </div>
    </div>
  );
}
