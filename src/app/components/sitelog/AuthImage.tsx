import { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { cn } from '../ui/utils';
import { siteLogPhotoUrl } from '../../services/siteLog';

/**
 * Renders a protected image. A bare <img src> can't carry the session cookie
 * reliably, so we fetch the bytes with credentials, turn them into a blob URL,
 * and revoke it on cleanup. Shared by the site-log grid/lightbox and the
 * Kanban task-attachment modal.
 *
 * Point it at an image either way:
 *   - `src`                  — a fully-formed authenticated URL (generic API); or
 *   - `siteLogId` + `photoId` — back-compat for the existing site-log call sites.
 */
export function AuthImage({
  src,
  siteLogId,
  photoId,
  alt,
  className,
  headers,
}: {
  src?: string;
  siteLogId?: number;
  photoId?: number;
  alt: string;
  className?: string;
  /** Extra request headers — e.g. the client-portal `Authorization: Bearer <session>`. */
  headers?: Record<string, string>;
}) {
  const url =
    src ?? (siteLogId != null && photoId != null ? siteLogPhotoUrl(siteLogId, photoId) : null);

  // Serialize so the effect deps stay primitive (callers pass inline objects).
  const headersKey = headers ? JSON.stringify(headers) : null;

  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!url) {
      setError(true);
      return;
    }
    let revoke: string | null = null;
    let cancelled = false;
    setBlobUrl(null);
    setError(false);
    fetch(url, {
      credentials: 'include' as RequestCredentials,
      headers: headersKey ? (JSON.parse(headersKey) as Record<string, string>) : undefined,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        const objectUrl = URL.createObjectURL(blob);
        revoke = objectUrl;
        setBlobUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [url, headersKey]);

  if (error) {
    return (
      <div className={cn('flex items-center justify-center bg-[#FAFAFA] text-[#D4D4D8]', className)}>
        <ImageOff className="w-6 h-6" />
      </div>
    );
  }
  if (!blobUrl) {
    return <div className={cn('bg-[#FAFAFA] animate-pulse', className)} aria-hidden />;
  }
  return <img src={blobUrl} alt={alt} className={className} />;
}
