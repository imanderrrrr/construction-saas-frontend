// BuildTrack — Signature capture canvas.
//
// Pointer events (not separate mouse/touch handlers) so a finger on a phone, a
// stylus on a tablet and a mouse on the office desktop all take the same path.
// The canvas is backed at devicePixelRatio so the stroke is not a blurry mess
// on a retina screen — the exported PNG is what ends up in the evidence trail.
//
// Exports PNG via toDataURL. That is deliberate and load-bearing: the backend
// accepts PNG only (magic bytes checked) because the stored image is served
// inline, and an inline SVG would be script execution in the viewer's session.
//
// The frame is the panel's dashed sand frame — the one a document without a
// photo shows on Cobrar — because an empty pad is the same kind of thing: a
// place where something is expected. Square, like every control in the panel.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Eraser } from 'lucide-react';
import { cn } from '../ui/utils';
import { FOCUS_RING } from '../onboarding/chrome';
import { Mono } from '../projects/bt';

interface SignaturePadProps {
  /** Called with the PNG data URL, or null when the pad is cleared/empty. */
  onChange: (dataUrl: string | null) => void;
  disabled?: boolean;
}

export function SignaturePad({ onChange, disabled = false }: SignaturePadProps) {
  const { t } = useTranslation('signatures');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const hasInk = useRef(false);
  const [empty, setEmpty] = useState(true);

  /** Size the backing store to the CSS box × DPR, then scale the context. */
  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    // Resizing clears the canvas, so only do it while the pad is still empty —
    // an orientation change mid-signature must not silently wipe the stroke.
    if (hasInk.current) return;
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0A0A0A';
  }, []);

  useEffect(() => {
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [resize]);

  const pointFrom = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const { x, y } = pointFrom(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    // A tap with no drag is still a mark — dot it so a short stroke registers.
    ctx.lineTo(x + 0.01, y);
    ctx.stroke();
    hasInk.current = true;
    if (empty) setEmpty(false);
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || disabled) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = pointFrom(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const end = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    drawing.current = false;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    const canvas = canvasRef.current;
    if (!canvas) return;
    onChange(hasInk.current ? canvas.toDataURL('image/png') : null);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasInk.current = false;
    setEmpty(true);
    onChange(null);
    // Now that the ink is gone, re-fit to the current box.
    resize();
  };

  return (
    <div className="space-y-2">
      <div className={cn('relative border-2 border-dashed bg-white transition-colors', empty ? 'border-[#DBD0BB]' : 'border-[#F97316]')}>
        <canvas
          ref={canvasRef}
          data-testid="signature-pad"
          aria-label={t('pad.aria')}
          className={`h-40 w-full touch-none ${
            disabled ? 'cursor-not-allowed opacity-60' : 'cursor-crosshair'
          }`}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          onPointerCancel={end}
        />
        {empty && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <Mono className="text-[10.5px] tracking-[0.12em] text-[#A69C8D]">{t('pad.placeholder')}</Mono>
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={clear}
        disabled={disabled || empty}
        className={cn(
          'inline-flex items-center gap-1.5 font-bt-mono text-[10px] uppercase tracking-[0.09em] text-[#8A8175] transition-colors hover:text-[#0A0A0A] disabled:cursor-default disabled:opacity-40',
          FOCUS_RING,
        )}
      >
        <Eraser className="h-3.5 w-3.5" strokeWidth={2} />
        {t('pad.clear')}
      </button>
    </div>
  );
}
