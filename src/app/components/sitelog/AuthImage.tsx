import { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { cn } from '../ui/utils';
import { siteLogPhotoUrl } from '../../services/siteLog';

/**
 * Renders a protected site-log photo. A bare <img src> can't carry the session
 * cookie reliably, so we fetch the bytes with credentials, turn them into a blob
 * URL, and revoke it on cleanup. Used for both grid thumbnails and the lightbox.
 */
export function AuthImage({
  siteLogId,
  photoId,
  alt,
  className,
}: {
  siteLogId: number;
  photoId: number;
  alt: string;
  className?: string;
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let revoke: string | null = null;
    let cancelled = false;
    setBlobUrl(null);
    setError(false);
    fetch(siteLogPhotoUrl(siteLogId, photoId), { credentials: 'include' as RequestCredentials })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        revoke = url;
        setBlobUrl(url);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [siteLogId, photoId]);

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
