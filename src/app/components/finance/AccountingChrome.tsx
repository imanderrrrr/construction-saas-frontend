import type { ReactNode } from 'react';
import { Bone, Mono } from '../projects/bt';

/** Shared accounting chrome, matching the paper and ink screens in Administration. */
export function AccountingHeader({ kicker, title, description, action }: {
  kicker: string; title: string; description: string; action?: ReactNode;
}) {
  return <header className="flex flex-wrap items-end justify-between gap-4">
    <div className="min-w-0">
      <Mono className="block text-[10px] tracking-[0.15em] text-[#8A8175]">{kicker}</Mono>
      <h2 className="font-bt-display font-extrabold uppercase text-4xl md:text-5xl leading-none text-[#0A0A0A] mt-2">{title}</h2>
      <p className="text-[13px] text-[#5A5346] mt-2">{description}</p>
    </div>
    {action}
  </header>;
}

export function AccountingFigure({ title, value, subtitle, tone = 'ink', isLoading = false, isError = false }: {
  title: string; value: string | number; subtitle: string;
  tone?: 'ink' | 'green' | 'orange' | 'red'; isLoading?: boolean; isError?: boolean;
}) {
  const colors = { ink: 'text-[#0A0A0A]', green: 'text-[#2E7D4F]', orange: 'text-[#C2410C]', red: 'text-[#B3402A]' };
  return <div className="min-w-0 p-4 md:p-5 border-r border-b border-[#EDE7DB]">
    <p className="font-bt-mono uppercase tracking-[0.1em] text-[10px] text-[#5A5346]">{title}</p>
    {isLoading ? <Bone className="h-8 w-3/4 mt-3" /> : <p className={`font-bt-display font-bold text-[30px] md:text-[36px] tabular-nums leading-none mt-3 break-words ${isError ? 'text-[#8A8175]' : colors[tone]}`}>{isError ? '—' : value}</p>}
    <p className="font-bt-mono text-[9px] uppercase tracking-[0.05em] text-[#8A8175] mt-2">{isLoading || isError ? '—' : subtitle}</p>
  </div>;
}
