import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { BtModal } from '../bt/windows';
import { PrimaryButton, SecondaryButton } from '../onboarding/chrome';
import { Mono } from '../projects/bt';
import { fmtUSD } from '../projects/helpers';
import type { ExpenseResponse } from '../../services/expenses';

/**
 * El recibo en grande, con zoom y arrastre.
 *
 * Es lo mejor que tenía la pantalla anterior y se conserva entero; lo que
 * cambia es el marco y una cosa que faltaba: **cuando la foto no carga se dice
 * y se puede reintentar**, en vez de quedarse en blanco. Distinto de «sin
 * recibo», que es otra cosa y ni siquiera ofrece este visor.
 */

const MIN = 0.25;
const MAX = 5;
const STEP = 0.25;

export function ReceiptViewer({ expense, onClose }: { expense: ExpenseResponse; onClose: () => void }) {
  const { t } = useTranslation(['admin', 'common']);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const translateStart = useRef({ x: 0, y: 0 });

  const url = expense.receiptUrl;

  useEffect(() => {
    if (!url) return;
    let revoke: string | null = null;
    let cancelled = false;
    setLoading(true); setError(null); setBlobUrl(null); setScale(1); setTranslate({ x: 0, y: 0 });
    fetch(url, { credentials: 'include' })
      .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.blob(); })
      .then(blob => {
        if (cancelled) return;
        revoke = URL.createObjectURL(blob);
        setBlobUrl(revoke);
      })
      .catch((err: unknown) => { if (!cancelled) setError(err instanceof Error ? err.message : 'ERROR'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; if (revoke) URL.revokeObjectURL(revoke); };
  }, [url, nonce]);

  const zoomIn = useCallback(() => setScale(s => Math.min(s + STEP, MAX)), []);
  const zoomOut = useCallback(() => setScale(s => Math.max(s - STEP, MIN)), []);
  const reset = useCallback(() => { setScale(1); setTranslate({ x: 0, y: 0 }); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '+' || e.key === '=') zoomIn();
      if (e.key === '-') zoomOut();
      if (e.key === '0') reset();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoomIn, zoomOut, reset]);

  const worker = expense.workerName ?? expense.workerUsername;

  return (
    <BtModal
      open
      onOpenChange={o => { if (!o) onClose(); }}
      width={880}
      kicker={`${worker} · ${fmtUSD(expense.amountCents)}`}
      title={t(`expenses.type.${expense.expenseType}`, { defaultValue: expense.expenseType })}
      footer={
        error ? (
          <div className="flex items-center justify-between gap-3">
            <Mono className="text-[9.5px] tracking-[0.08em] text-[#A69C8D]">{error}</Mono>
            <div className="flex gap-2.5">
              <SecondaryButton onClick={onClose}>{t('common:buttons.close')}</SecondaryButton>
              <PrimaryButton onClick={() => setNonce(n => n + 1)}>{t('expenses.retry')}</PrimaryButton>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <ViewerButton onClick={zoomOut} label={t('common:buttons.zoomOut', 'Zoom out')}><ZoomOut className="w-3.5 h-3.5" /></ViewerButton>
              <Mono className="text-[10px] tabular-nums text-[#5A5346] w-12 text-center">{Math.round(scale * 100)}%</Mono>
              <ViewerButton onClick={zoomIn} label={t('common:buttons.zoomIn', 'Zoom in')}><ZoomIn className="w-3.5 h-3.5" /></ViewerButton>
              <ViewerButton onClick={reset} label={t('common:buttons.reset')}><RotateCcw className="w-3.5 h-3.5" /></ViewerButton>
            </div>
            <SecondaryButton onClick={onClose}>{t('common:buttons.close')}</SecondaryButton>
          </div>
        )
      }
    >
      {error ? (
        <div className="py-8 text-center">
          <p className="font-bt-display font-extrabold uppercase text-[24px] leading-none text-[#0A0A0A]">
            {t('expenses.receiptErrorTitle')}
          </p>
          <p className="text-[12.5px] leading-[1.55] text-[#5A5346] mt-2.5 max-w-[46ch] mx-auto">
            {t('expenses.receiptErrorBody')}
          </p>
        </div>
      ) : (
        <div
          className="relative h-[52vh] min-h-[280px] overflow-hidden bg-[#0A0A0A] cursor-grab active:cursor-grabbing"
          onMouseDown={e => { dragging.current = true; dragStart.current = { x: e.clientX, y: e.clientY }; translateStart.current = translate; }}
          onMouseMove={e => {
            if (!dragging.current) return;
            setTranslate({
              x: translateStart.current.x + (e.clientX - dragStart.current.x),
              y: translateStart.current.y + (e.clientY - dragStart.current.y),
            });
          }}
          onMouseUp={() => { dragging.current = false; }}
          onMouseLeave={() => { dragging.current = false; }}
        >
          {loading && (
            <span className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-[#8A8175] animate-spin" />
            </span>
          )}
          {blobUrl && (
            <img
              src={blobUrl}
              alt={t('expenses.receipt.view')}
              draggable={false}
              className="absolute left-1/2 top-1/2 max-w-none select-none"
              style={{ transform: `translate(-50%, -50%) translate(${translate.x}px, ${translate.y}px) scale(${scale})` }}
            />
          )}
        </div>
      )}
    </BtModal>
  );
}

function ViewerButton({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="w-8 h-8 flex items-center justify-center border border-[#DBD0BB] bg-white text-[#5A5346] hover:border-[#F97316] hover:text-[#C2410C] transition-colors"
    >
      {children}
    </button>
  );
}
