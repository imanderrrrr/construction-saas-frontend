import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../ui/utils';
import { Mono } from '../projects/bt';
import type { ClientResponse, ClientStatus } from '../../services/clients';

/**
 * Small pieces the Clientes screens share (Claude Design "Clientes
 * BuildTrack", 2026-09): the status chip, the empty cell and the two counts
 * every row and the ficha read off a client.
 */

const CHIP = 'inline-flex items-center font-bt-mono text-[9.5px] uppercase tracking-[0.1em] whitespace-nowrap';

/** Activo on sand, Inactivo outlined (border #DBD0BB, text #5A5346); `onDark` is the ink-bar variant. */
export function ClientStatusChip({ status, onDark = false, className }: { status: ClientStatus; onDark?: boolean; className?: string }) {
  const { t } = useTranslation('common');
  const look = status === 'ACTIVE'
    ? cn('px-2 py-1', onDark ? 'bg-[#F5F1E8] text-[#0A0A0A]' : 'bg-[#F3EEE4] text-[#0A0A0A]')
    : cn('border px-[7px] py-[3px]', onDark ? 'border-[rgba(245,241,232,0.4)] text-[#F5F1E8]' : 'border-[#DBD0BB] text-[#5A5346]');
  return <span className={cn(CHIP, look, className)}>{t(`status.${status.toLowerCase()}`)}</span>;
}

/** An empty cell: mono 10.5 px #A69C8D in uppercase — never italic, never a dash. */
export function CellEmpty({ children, className }: { children: ReactNode; className?: string }) {
  return <Mono className={cn('text-[10.5px] tracking-[0.06em] text-[#A69C8D]', className)}>{children}</Mono>;
}

/** Jobsites in ACTIVE status. A backend that predates the field counts as none. */
export function activeCount(c: ClientResponse): number {
  return c.activeProjectsCount ?? 0;
}

/** Jobsites in CLOSED status. */
export function closedCount(c: ClientResponse): number {
  return c.completedProjectsCount ?? 0;
}

/** What "Copiar datos de facturación" puts on the clipboard: one datum per line, blanks skipped. */
export function billingText(c: ClientResponse): string {
  return [c.name, c.rfc, c.contact, c.phone, c.email]
    .map(v => v?.trim())
    .filter((v): v is string => !!v)
    .join('\n');
}
