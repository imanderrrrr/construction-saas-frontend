import { useCallback, useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Download, X } from 'lucide-react';
import { AuthImage } from './AuthImage';
import { cn } from '../ui/utils';

export interface LightboxImage {
  /** Stable key. */
  id: string | number;
  /** Authenticated image URL — fetched (with credentials) by AuthImage. */
  url: string;
  alt?: string;
  /** Filename used when the built-in Download saves the file. */
  downloadName?: string | null;
  /** Optional primary caption line. */
  caption?: ReactNode;
  /** Optional secondary metadata line (uploader, date, …). */
  meta?: ReactNode;
}

export interface LightboxLabels {
  counter?: (current: number, total: number) => string;
  download?: string;
  prev?: string;
  next?: string;
  close?: string;
}

const DEFAULT_LABELS: Required<LightboxLabels> = {
  counter: (c, t) => `${c} / ${t}`,
  download: 'Descargar',
  prev: 'Anterior',
  next: 'Siguiente',
  close: 'Cerrar',
};

/**
 * Generic full-screen image lightbox: dimmed backdrop, centered image,
 * prev/next (arrow keys + buttons), thumbnail strip, ESC / backdrop-click to
 * close, and a built-in authenticated Download. Extra actions (e.g. delete)
 * mount via `actions`. Images load through <AuthImage> (blob + session cookie).
 *
 * Shared by the site-log PhotoLightbox and the Kanban task-attachment modal —
 * hence "image URLs + start index" rather than any domain-specific shape.
 */
export function Lightbox({
  images,
  index,
  onIndexChange,
  onClose,
  actions,
  showDownload = true,
  labels,
  onDownloadError,
  imageHeaders,
}: {
  images: LightboxImage[];
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
  actions?: (img: LightboxImage) => ReactNode;
  showDownload?: boolean;
  labels?: LightboxLabels;
  onDownloadError?: (err: unknown) => void;
  /** Extra request headers for image fetches — e.g. the client-portal bearer. */
  imageHeaders?: Record<string, string>;
}) {
  const l = { ...DEFAULT_LABELS, ...labels };
  const total = images.length;
  const image = images[index];

  const goPrev = useCallback(() => {
    if (total > 1) onIndexChange((index - 1 + total) % total);
  }, [index, total, onIndexChange]);

  const goNext = useCallback(() => {
    if (total > 1) onIndexChange((index + 1) % total);
  }, [index, total, onIndexChange]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, goPrev, goNext]);

  const handleDownload = useCallback(async () => {
    if (!image) return;
    try {
      const res = await fetch(image.url, {
        credentials: 'include' as RequestCredentials,
        headers: imageHeaders,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = image.downloadName ?? `image-${image.id}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
    } catch (err) {
      onDownloadError?.(err);
    }
  }, [image, onDownloadError, imageHeaders]);

  if (!image) return null;
  if (typeof document === 'undefined') return null;

  // Portal to <body>: the modal that hosts this lightbox centers itself with a
  // CSS transform, which would otherwise make `position: fixed` resolve against
  // the modal box instead of the viewport. Rendering at the body root guarantees
  // a true full-screen overlay regardless of any transformed ancestor.
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-black/90"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      {/* Top bar: counter + actions (stop propagation so clicks here don't close) */}
      <div
        className="flex items-center justify-between px-4 py-3 text-white/90"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="font-mono text-sm tabular-nums">{l.counter(index + 1, total)}</span>
        <div className="flex items-center gap-1">
          {actions?.(image)}
          {showDownload && (
            <button
              type="button"
              onClick={handleDownload}
              title={l.download}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              <Download className="h-5 w-5" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            title={l.close}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Main image + arrows. This container has NO onClick, so clicking the
          dark margin beside the image bubbles to the backdrop and closes. The
          image and arrows stop propagation so they don't close. */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4">
        {total > 1 && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
            title={l.prev}
            className="absolute left-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}

        <div
          onClick={(e) => e.stopPropagation()}
          className="flex max-h-full max-w-full items-center justify-center"
        >
          <AuthImage
            key={image.id}
            src={image.url}
            alt={image.alt ?? ''}
            className="max-h-full max-w-full rounded-md object-contain"
            headers={imageHeaders}
          />
        </div>

        {total > 1 && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); goNext(); }}
            title={l.next}
            className="absolute right-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
      </div>

      {/* Caption footer */}
      {(image.caption || image.meta) && (
        <div className="px-4 py-3 text-white/90" onClick={(e) => e.stopPropagation()}>
          {image.caption && <p className="text-sm font-semibold">{image.caption}</p>}
          {image.meta && (
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/60">
              {image.meta}
            </div>
          )}
        </div>
      )}

      {/* Thumbnail strip */}
      {total > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto px-4 pb-4" onClick={(e) => e.stopPropagation()}>
          {images.map((img, i) => (
            <button
              key={img.id}
              type="button"
              onClick={() => onIndexChange(i)}
              className={cn(
                'h-16 w-16 flex-shrink-0 overflow-hidden rounded-md border-2 transition-colors',
                i === index ? 'border-[#F97316]' : 'border-transparent opacity-60 hover:opacity-100',
              )}
            >
              <AuthImage src={img.url} alt="" className="h-full w-full object-cover" headers={imageHeaders} />
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body,
  );
}
