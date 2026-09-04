import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useRef, type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../ui/utils';
import { CloseButton, InkBar, WINDOW_SHADOW } from '../onboarding/chrome';
import { Mono } from '../projects/bt';

/**
 * The two auxiliary window formats of the redesign (Claude Design "Proyectos
 * Ventanas BuildTrack", fase 3), on Radix Dialog for focus, Escape and aria:
 *
 * - BtModal — centred, 440–880 px, for what interrupts and must be read:
 *   activate / deactivate, close, delete, create client, close an RFI.
 * - BtDrawer — 492 px from the right with an ink header, for what creates an
 *   item with several fields: new punch item, new RFI, edit draft.
 *
 * On phones both become a full sheet with the actions stacked at the foot.
 * Radius 0, paper footer, the section's shadow. The overlay sits above the
 * app's own dialogs (z-50) and the full-screen project window (z-90, the
 * client modal opens on top of it), and below the tour spotlight (z-100).
 */

const OVERLAY = 'fixed inset-0 z-[95] bg-[rgba(11,10,9,0.40)] bt-fade-in';
const FOOTER = 'flex-shrink-0 border-t border-[#EDE7DB] bg-[#FAF7F0] px-5 md:px-[22px] py-3.5 flex flex-col-reverse gap-2.5 md:flex-row md:items-center md:justify-end';

export function BtModal({
  open, onOpenChange, width = 440, kicker, kickerTone = 'orange', title, description, footer, children,
  dismissible = true, closeDisabled = false, bodyClassName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Desktop width in px (440 / 460 / 520 / 880 on the sheet). */
  width?: number;
  kicker?: ReactNode;
  kickerTone?: 'orange' | 'red';
  title: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
  /** Backdrop click closes (off for forms that would lose typed input). */
  dismissible?: boolean;
  closeDisabled?: boolean;
  bodyClassName?: string;
}) {
  const { t } = useTranslation(['common']);
  const panelRef = useRef<HTMLDivElement>(null);
  const close = () => { if (!closeDisabled) onOpenChange(false); };
  return (
    <DialogPrimitive.Root open={open} onOpenChange={o => { if (!o && closeDisabled) return; onOpenChange(o); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={OVERLAY} />
        <DialogPrimitive.Content
          className="fixed inset-0 z-[96] flex items-stretch md:items-center md:justify-center md:p-6 outline-none"
          {...(description ? {} : { 'aria-describedby': undefined })}
          onOpenAutoFocus={e => { e.preventDefault(); panelRef.current?.focus(); }}
          onPointerDownOutside={e => { if (!dismissible || closeDisabled) e.preventDefault(); }}
          onInteractOutside={e => { if (!dismissible || closeDisabled) e.preventDefault(); }}
          onClick={e => { if (dismissible && e.target === e.currentTarget) close(); }}
        >
          <div
            ref={panelRef}
            tabIndex={-1}
            className={cn('bt-window-in bg-white flex flex-col w-full md:w-[var(--bt-w)] md:max-w-full max-h-full md:max-h-[calc(100vh-48px)] outline-none', WINDOW_SHADOW)}
            style={{ '--bt-w': `${width}px` } as CSSProperties}
          >
            <div className="flex items-start justify-between gap-4 px-5 pt-5 md:px-[22px] md:pt-[22px]">
              <div className="min-w-0">
                {kicker && (
                  <Mono className={cn('block text-[10px] font-semibold tracking-[0.14em]', kickerTone === 'red' ? 'text-[#B3402A]' : 'text-[#C2410C]')}>{kicker}</Mono>
                )}
                <DialogPrimitive.Title className="font-bt-display font-extrabold uppercase text-[26px] md:text-[28px] leading-none text-[#0A0A0A] mt-1.5">
                  {title}
                </DialogPrimitive.Title>
                {description && (
                  <DialogPrimitive.Description className="text-[13.5px] leading-[1.55] text-[#5A5346] mt-2">{description}</DialogPrimitive.Description>
                )}
              </div>
              <CloseButton onClick={close} disabled={closeDisabled} aria-label={t('common:buttons.close')} className="flex-shrink-0" />
            </div>
            <div className={cn('flex-1 min-h-0 overflow-y-auto px-5 md:px-[22px] py-4', bodyClassName)}>{children}</div>
            {footer && <div className={FOOTER}>{footer}</div>}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function BtDrawer({
  open, onOpenChange, width = 492, kicker, title, footer, children, closeDisabled = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  width?: number;
  kicker?: ReactNode;
  title: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
  closeDisabled?: boolean;
}) {
  const { t } = useTranslation(['common']);
  const panelRef = useRef<HTMLDivElement>(null);
  const close = () => { if (!closeDisabled) onOpenChange(false); };
  return (
    <DialogPrimitive.Root open={open} onOpenChange={o => { if (!o && closeDisabled) return; onOpenChange(o); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={OVERLAY} />
        <DialogPrimitive.Content
          className="fixed inset-0 z-[96] flex justify-end outline-none"
          aria-describedby={undefined}
          onOpenAutoFocus={e => { e.preventDefault(); panelRef.current?.focus(); }}
          onPointerDownOutside={e => { if (closeDisabled) e.preventDefault(); }}
          onInteractOutside={e => { if (closeDisabled) e.preventDefault(); }}
          onClick={e => { if (e.target === e.currentTarget) close(); }}
        >
          <div
            ref={panelRef}
            tabIndex={-1}
            className="bt-drawer-in bg-white flex flex-col h-full w-full md:w-[var(--bt-w)] md:max-w-full md:border-l-[3px] md:border-l-[#CDBFA6] shadow-[-24px_0_48px_-30px_rgba(11,10,9,0.6)] outline-none"
            style={{ '--bt-w': `${width}px` } as CSSProperties}
          >
            <InkBar grid={24} className="flex-shrink-0 px-5 py-4 md:px-[22px] md:py-[18px]">
              <div className="relative flex items-start justify-between gap-4">
                <div className="min-w-0">
                  {kicker && <Mono className="block text-[10px] font-semibold tracking-[0.14em] text-[#F97316] truncate">{kicker}</Mono>}
                  <DialogPrimitive.Title className="font-bt-display font-extrabold uppercase text-[26px] leading-none text-[#F5F1E8] mt-1">
                    {title}
                  </DialogPrimitive.Title>
                </div>
                <CloseButton onDark onClick={close} disabled={closeDisabled} aria-label={t('common:buttons.close')} className="w-8 h-8 flex-shrink-0" />
              </div>
            </InkBar>
            <div className="flex-1 min-h-0 overflow-y-auto px-5 md:px-[22px] py-5">{children}</div>
            {footer && <div className={FOOTER}>{footer}</div>}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** "▸ item" list of a notice — the paper notes of 04C / 04D. */
export function BulletList({ items, className }: { items: ReactNode[]; className?: string }) {
  return (
    <ul className={cn('flex flex-col gap-1.5', className)}>
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-[13px] leading-[1.5] text-[#0A0A0A]">
          <span className="font-bt-mono text-[10px] text-[#F97316] pt-[3px]" aria-hidden="true">▸</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
