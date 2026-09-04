import { useCallback, useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, Download, X } from 'lucide-react';
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

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-[#F97316] focus-visible:outline-offset-[3px]';
const BAR_BUTTON = cn('inline-flex items-center gap-1.5 font-bt-mono text-[10px] font-semibold uppercase tracking-[0.1em] px-3 py-2 border border-[rgba(245,241,232,0.25)] text-[#F5F1E8] hover:border-[#F97316] hover:text-[#F97316] transition-colors disabled:opacity-40 disabled:pointer-events-none', FOCUS);

/**
 * Generic full-screen image viewer (Claude Design "Proyectos Ventanas" 04M):
 * an ink overlay at 92 %, a mono counter, square controls, the caption and
 * its meta line under the image, "← Anterior / Siguiente →" and the thumbnail
 * strip at the foot. Prev/next also on the arrow keys, Escape / backdrop-click
 * closes, and a built-in authenticated Download. Extra actions (e.g. delete)
 * mount via `actions`. Images load through <AuthImage> (blob + session cookie).
 *
 * Shared by the site-log PhotoLightbox, the punch list, the RFIs and the
 * Kanban task-attachment modal — hence "image URLs + start index" rather than
 * any domain-specific shape.
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
      className="fixed inset-0 z-[100] flex flex-col bg-[rgba(11,10,9,0.92)] text-[#F5F1E8]"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      {/* Top bar: counter + actions (stop propagation so clicks here don't close) */}
      <div
        className="flex items-center justify-between gap-3 px-4 md:px-6 py-3"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="font-bt-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[#F97316] tabular-nums">{l.counter(index + 1, total)}</span>
        <div className="flex items-center gap-2">
          {actions?.(image)}
          {showDownload && (
            <button type="button" onClick={handleDownload} title={l.download} className={BAR_BUTTON}>
              <Download className="h-3.5 w-3.5" strokeWidth={2} />
              <span className="hidden sm:inline">{l.download}</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            title={l.close}
            aria-label={l.close}
            className={cn('flex h-8 w-8 items-center justify-center border border-[rgba(245,241,232,0.3)] text-[#F5F1E8] hover:border-[#F97316] hover:text-[#F97316] transition-colors', FOCUS)}
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Main image. This container has NO onClick, so clicking the dark margin
          beside the image bubbles to the backdrop and closes; the image itself
          stops propagation. */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4">
        <div onClick={(e) => e.stopPropagation()} className="flex max-h-full max-w-full items-center justify-center">
          <AuthImage
            key={image.id}
            src={image.url}
            alt={image.alt ?? ''}
            className="max-h-full max-w-full object-contain"
            headers={imageHeaders}
          />
        </div>
      </div>

      {/* Caption */}
      {(image.caption || image.meta) && (
        <div className="px-4 md:px-6 pt-3" onClick={(e) => e.stopPropagation()}>
          {image.caption && <p className="text-[15px] font-semibold text-[#F5F1E8]">{image.caption}</p>}
          {image.meta && (
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-bt-mono text-[9.5px] uppercase tracking-[0.1em] text-[rgba(245,241,232,0.65)]">
              {image.meta}
            </div>
          )}
        </div>
      )}

      {/* Foot: prev / thumbnails / next */}
      <div className="flex items-center justify-between gap-3 px-4 md:px-6 py-4" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={goPrev} disabled={total <= 1} title={l.prev} className={BAR_BUTTON}>
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
          <span className="hidden sm:inline">{l.prev}</span>
        </button>
        {total > 1 ? (
          <div className="flex items-center gap-2 overflow-x-auto bt-scroll-none min-w-0">
            {images.map((img, i) => (
              <button
                key={img.id}
                type="button"
                onClick={() => onIndexChange(i)}
                aria-label={l.counter(i + 1, total)}
                aria-current={i === index || undefined}
                className={cn(
                  'h-14 w-14 flex-shrink-0 overflow-hidden border-2 transition-colors',
                  i === index ? 'border-[#F97316]' : 'border-transparent opacity-60 hover:opacity-100',
                  FOCUS,
                )}
              >
                <AuthImage src={img.url} alt="" className="h-full w-full object-cover" headers={imageHeaders} />
              </button>
            ))}
          </div>
        ) : (
          <span className="font-bt-mono text-[10px] uppercase tracking-[0.12em] text-[rgba(245,241,232,0.5)]">{l.counter(index + 1, total)}</span>
        )}
        <button type="button" onClick={goNext} disabled={total <= 1} title={l.next} className={BAR_BUTTON}>
          <span className="hidden sm:inline">{l.next}</span>
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      </div>
    </div>,
    document.body,
  );
}
