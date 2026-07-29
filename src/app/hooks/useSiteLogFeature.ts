import { useEffect, useState } from 'react';
import { getSiteLogFeature } from '../services/siteLog';

/**
 * Whether the current tenant's plan includes the bitácora feature.
 * Default-deny: any error (incl. 402/403) resolves to `false` so the UI hides
 * the module rather than showing a broken section.
 */
export function useSiteLogFeature(): { enabled: boolean; loading: boolean } {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getSiteLogFeature()
      .then((res) => { if (!cancelled) setEnabled(res.enabled); })
      .catch(() => { if (!cancelled) setEnabled(false); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { enabled, loading };
}
