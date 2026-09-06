import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, Check, Copy, Lock, Plus } from 'lucide-react';
import { cn } from '../ui/utils';
import { useTourScopeWhileMounted } from '../../lib/tourScope';
import type { ClientResponse } from '../../services/clients';
import { listProjects, type ProjectResponse } from '../../services/projects';
import { FOCUS_RING, InkBar, PrimaryButton, SecondaryButton, TertiaryButton } from '../onboarding/chrome';
import { Bone, CreateButton, EmptyWord, Mono, stampDay } from '../projects/bt';
import { StatusBadge } from '../projects/badges';
import { fmtUSD } from '../projects/helpers';
import { DarkButton, FichaTabs, Panel, Row, SubHead, type FichaTabDef } from '../projects/ficha/panel';
import { ProjectWindow } from '../projects/ProjectWindow';
import { activeCount, billingText, CellEmpty, ClientStatusChip, closedCount } from './bits';

/**
 * The client ficha (Claude Design "Clientes BuildTrack" 02 / 02B): a page,
 * not a drawer — sister of the jobsite ficha, same breadcrumb, same square
 * tabs. The identity data would fit in 492 px, but the Obras tab is a table
 * with a link into each jobsite's ficha, and a drawer would have to stack a
 * second layer to get there.
 *
 * Three tabs: Resumen (who to call, how they get invoiced, how much they
 * have built with you), Obras (everything built for them, open and closed)
 * and Facturas, padlocked: invoices are not linked to the client yet and no
 * balance gets invented here.
 */

export type ClientFichaTab = 'resumen' | 'obras' | 'facturas';
/** How many jobsites the Obras tab shows before sending you to Proyectos for the rest. */
export const FICHA_PROJECTS = 20;
const COPIED_MS = 1500;

const OBRAS_GRID = 'grid grid-cols-1 md:grid-cols-[2.2fr_1.2fr_.9fr_1fr] gap-x-3 gap-y-1 items-center';

export function ClientFicha({ client, onBack, onEdit, onToggleStatus, onOpenProjects, onOpenProject, onClientChanged, initialTab = 'resumen' }: {
  client: ClientResponse;
  onBack: () => void;
  onEdit: () => void;
  onToggleStatus: () => void;
  /** "Ver todas en Proyectos →": the parent hands the list to Proyectos with this client as the filter. */
  onOpenProjects: () => void;
  /** A row of the Obras tab: open that jobsite's ficha in Proyectos. */
  onOpenProject: (projectId: number) => void;
  /** A jobsite was created from here — the counts moved, re-read the client. */
  onClientChanged: () => void;
  initialTab?: ClientFichaTab;
}) {
  const { t, i18n } = useTranslation(['admin', 'common']);
  const lang = i18n.language;
  const [tab, setTab] = useState<ClientFichaTab>(initialTab);
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [projectsTotal, setProjectsTotal] = useState<number | null>(null);
  const [projectsState, setProjectsState] = useState<'loading' | 'error' | 'data'>('loading');
  const [createOpen, setCreateOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // The ficha owns the tour while it is on screen (lib/tourScope).
  useTourScopeWhileMounted('clients-ficha', t('admin:clients.ficha.tourLabel'));

  const loadProjects = useCallback(() => {
    let cancelled = false;
    setProjectsState('loading');
    listProjects({ clientId: client.id, page: 0, size: FICHA_PROJECTS })
      .then(page => {
        if (cancelled) return;
        setProjects(page.content);
        setProjectsTotal(page.totalElements);
        setProjectsState('data');
      })
      .catch(() => { if (!cancelled) setProjectsState('error'); });
    return () => { cancelled = true; };
  }, [client.id]);

  useEffect(() => loadProjects(), [loadProjects]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), COPIED_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copyBilling = async () => {
    try {
      await navigator.clipboard.writeText(billingText(client));
      setCopied(true);
    } catch {
      /* no clipboard (http, permissions): the button just does not confirm */
    }
  };

  const active = activeCount(client);
  const closed = closedCount(client);
  const kicker = [t('admin:clients.ficha.kicker', { id: client.id }), client.rfc].filter(Boolean).join(' · ');
  const since = stampDay(client.createdAt, lang);

  const tabs: FichaTabDef<ClientFichaTab>[] = [
    { key: 'resumen', label: t('admin:clients.ficha.tab.resumen') },
    { key: 'obras', label: t('admin:clients.ficha.tab.obras'), count: projectsTotal ?? active + closed },
    { key: 'facturas', label: t('admin:clients.ficha.tab.facturas'), locked: true },
  ];

  const shortcuts = (
    <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2.5 mt-5" data-tour="sec.clients-ficha.shortcuts">
      <SecondaryButton onClick={copyBilling} className="px-[15px] py-[10px] text-[10px] gap-1.5 bg-[#FAF7F0]" aria-live="polite">
        {copied ? <Check className="w-3.5 h-3.5" strokeWidth={2.2} /> : <Copy className="w-3.5 h-3.5" strokeWidth={2} />}
        {copied ? t('admin:clients.ficha.copied') : t('admin:clients.ficha.copyBilling')}
      </SecondaryButton>
      <PrimaryButton onClick={() => setCreateOpen(true)} className="px-[15px] py-[10px] text-[10px] gap-1.5">
        <Plus className="w-3.5 h-3.5" strokeWidth={2.4} />{t('admin:clients.ficha.createProject')}
      </PrimaryButton>
    </div>
  );

  const content = tab === 'resumen' ? (
    <Panel title={t('admin:clients.ficha.tab.resumen')} purpose={t('admin:clients.ficha.purpose.resumen')}>
      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6 lg:gap-[30px]">
        <div>
          <Row label={t('admin:clients.ficha.field.name')}><span className="font-semibold">{client.name}</span></Row>
          <Row label={t('admin:clients.ficha.field.contact')}>{client.contact ?? <CellEmpty>{t('admin:clients.row.noContact')}</CellEmpty>}</Row>
          <Row label={t('admin:clients.ficha.field.taxId')}>
            {client.rfc ? <Mono className="text-[12px] tracking-[0.04em]">{client.rfc}</Mono> : <CellEmpty>{t('admin:clients.row.noTaxIdLong')}</CellEmpty>}
          </Row>
          <Row label={t('admin:clients.ficha.field.phone')}>
            {client.phone ? <Mono className="text-[12px] tracking-[0.04em]">{client.phone}</Mono> : <CellEmpty>{t('admin:clients.row.noPhone')}</CellEmpty>}
          </Row>
          <Row label={t('admin:clients.ficha.field.email')}>{client.email ?? <CellEmpty>{t('admin:clients.row.noEmail')}</CellEmpty>}</Row>
          <Row label={t('admin:clients.ficha.field.status')}><ClientStatusChip status={client.status} /></Row>
          <Row label={t('admin:clients.ficha.field.since')}><Mono className="text-[12px] tracking-[0.04em]">{since}</Mono></Row>
          <Row label={t('admin:clients.ficha.field.closed')}><Mono className="text-[12.5px] tabular-nums">{closed}</Mono></Row>
          <Row label={t('admin:clients.ficha.field.id')}><Mono className="text-[12px]">#{client.id}</Mono></Row>
          {shortcuts}
        </div>
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 border border-[#E7E1D5]">
            <div className="px-4 py-3.5 border-r border-[#E7E1D5]">
              <div className="font-bt-display font-extrabold text-[40px] leading-[0.85] text-[#0A0A0A] tabular-nums">{active}</div>
              <Mono className="block text-[9.5px] tracking-[0.12em] text-[#5A5346] mt-1.5">{t('admin:clients.ficha.figure.inProgress')}</Mono>
            </div>
            <div className="px-4 py-3.5">
              <div className="font-bt-display font-extrabold text-[40px] leading-[0.85] text-[#0A0A0A] tabular-nums">{closed}</div>
              <Mono className="block text-[9.5px] tracking-[0.12em] text-[#5A5346] mt-1.5">{t('admin:clients.ficha.figure.closed')}</Mono>
            </div>
          </div>
          <div className="bg-[#FAF7F0] border border-[#EDE7DB] px-4 py-3.5">
            <Mono className="flex items-center gap-1.5 text-[9.5px] font-semibold tracking-[0.12em] text-[#8A8175]">
              <Lock className="w-[11px] h-[11px]" strokeWidth={2.2} aria-hidden="true" />{t('admin:clients.ficha.invoicesLocked')}
            </Mono>
            <p className="text-[12.5px] leading-[1.55] text-[#5A5346] mt-1.5">{t('admin:clients.ficha.invoicesLockedBody')}</p>
          </div>
          <div>
            <SubHead>{t('admin:clients.ficha.appearsIn')}</SubHead>
            <p className="text-[12.5px] leading-[1.55] text-[#5A5346]">{t('admin:clients.ficha.appearsInBody')}</p>
          </div>
        </div>
      </div>
    </Panel>
  ) : tab === 'obras' ? (
    <Panel title={t('admin:clients.ficha.tab.obras')} purpose={t('admin:clients.ficha.purpose.obras')}>
      {projectsState === 'loading' && (
        <div className="flex flex-col gap-2"><Bone className="h-10 w-full" /><Bone className="h-10 w-full" /><Bone className="h-10 w-full" /></div>
      )}
      {projectsState === 'error' && (
        <EmptyWord tone="red" word={t('admin:clients.error.big')} title={t('admin:clients.ficha.obras.error.title')} hint={t('admin:clients.error.hint')} className="border-0 py-9"
          action={<SecondaryButton onClick={loadProjects} className="bg-[#FAF7F0]">{t('common:buttons.retry')}</SecondaryButton>} />
      )}
      {projectsState === 'data' && projects.length === 0 && (
        <EmptyWord word={t('admin:clients.ficha.obras.empty.big')} title={t('admin:clients.ficha.obras.empty.title')} className="border-0 py-9"
          action={<CreateButton onClick={() => setCreateOpen(true)}><Plus className="w-3.5 h-3.5" strokeWidth={2.4} />{t('admin:clients.ficha.obras.create')}</CreateButton>} />
      )}
      {projectsState === 'data' && projects.length > 0 && (
        <div data-testid="client-projects">
          <div className={cn(OBRAS_GRID, 'hidden md:grid bg-[#FBF8F2] border-y border-[#E7E1D5] px-3 py-2')}>
            {[t('admin:clients.ficha.obras.project'), t('admin:clients.ficha.obras.code'), t('common:labels.status'), t('admin:clients.ficha.obras.contract')].map((h, i) => (
              <Mono key={h} className={cn('text-[9.5px] tracking-[0.13em] text-[#8A8175]', i === 3 && 'md:text-right')}>{h}</Mono>
            ))}
          </div>
          {projects.map(p => (
            <div
              key={p.id}
              role="button"
              tabIndex={0}
              onClick={() => onOpenProject(p.id)}
              onKeyDown={e => { if (e.key === 'Enter') onOpenProject(p.id); }}
              className={cn(OBRAS_GRID, 'px-3 py-2.5 border-b border-[#F0EBE1] border-l-2 border-l-transparent cursor-pointer hover:bg-[#FBF8F2] hover:border-l-[#F97316]', p.status === 'CLOSED' && 'opacity-75', FOCUS_RING, 'focus-visible:outline-offset-[-2px]')}
            >
              <span className="text-[13.5px] font-semibold text-[#0A0A0A] truncate">{p.name}</span>
              {p.costCode ? <Mono className="text-[11.5px] tracking-[0.04em] text-[#0A0A0A]">{p.costCode}</Mono> : <CellEmpty>{t('admin:clients.ficha.obras.noCode')}</CellEmpty>}
              <div><StatusBadge status={p.status} /></div>
              <Mono className="text-[12px] tabular-nums text-[#0A0A0A] md:text-right">{fmtUSD(p.revisedContractCents ?? p.originalContractCents)}</Mono>
            </div>
          ))}
          <div className="flex items-center justify-between gap-3 mt-3.5">
            <Mono className="text-[10px] tracking-[0.08em] text-[#8A8175]">
              {t('admin:clients.ficha.obras.range', { start: 1, end: projects.length, total: projectsTotal ?? projects.length })}
            </Mono>
            <TertiaryButton onClick={onOpenProjects} className="inline-flex items-center gap-1.5">
              {t('admin:clients.ficha.obras.viewAll')}<ArrowRight className="w-3 h-3" strokeWidth={2.2} />
            </TertiaryButton>
          </div>
        </div>
      )}
    </Panel>
  ) : (
    <Panel title={t('admin:clients.ficha.tab.facturas')} purpose={t('admin:clients.ficha.purpose.facturas')}>
      <EmptyWord word={t('admin:clients.ficha.facturas.big')} title={t('admin:clients.ficha.facturas.title')} className="border-0 py-9" />
    </Panel>
  );

  return (
    <div className="max-w-[1206px]">
      <nav aria-label={t('admin:clients.ficha.breadcrumb')} className="mb-3.5">
        <button
          type="button"
          onClick={onBack}
          className={cn('group inline-flex items-center gap-2 font-bt-mono text-[10px] font-semibold uppercase tracking-[0.13em] text-[#5A5346] hover:text-[#C2410C] max-w-full', FOCUS_RING)}
        >
          <ArrowLeft className="w-3.5 h-3.5 text-[#C2410C]" strokeWidth={2.2} />
          <span>{t('admin:clients.ficha.breadcrumb')}</span>
          <span className="text-[#B4A992]">/</span>
          <span className="text-[#0A0A0A] group-hover:text-[#C2410C] truncate">{client.name}</span>
        </button>
      </nav>

      <div data-tour="sec.clients-ficha.bar">
        <InkBar grid={26} className="px-4 py-4 md:px-5 md:pt-4 md:pb-[18px]">
          <div className="relative flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="min-w-0">
              <Mono className="block text-[10px] font-semibold tracking-[0.14em] text-[#F97316] truncate">{kicker}</Mono>
              <h2 className="font-bt-display font-extrabold uppercase text-[28px] md:text-[38px] leading-none tracking-[0.01em] mt-1.5 break-words">{client.name}</h2>
              <div className="flex flex-wrap items-center gap-2 mt-2.5">
                <ClientStatusChip status={client.status} onDark />
                <Mono className="text-[10px] tracking-[0.1em] text-[rgba(245,241,232,0.7)]">
                  {t('admin:clients.ficha.since', { date: since })}{active > 0 && ` · ${t('admin:clients.ficha.inProgress', { count: active })}`}
                </Mono>
              </div>
            </div>
            <div className="grid grid-cols-2 md:flex md:flex-wrap md:items-center gap-2 md:justify-end flex-shrink-0">
              <DarkButton onClick={onToggleStatus} className="w-full md:w-auto">
                {client.status === 'ACTIVE' ? t('admin:clients.menu.deactivate') : t('admin:clients.menu.reactivate')}
              </DarkButton>
              <PrimaryButton onClick={onEdit} className="w-full md:w-auto px-[15px] py-[10px] text-[10px]">{t('admin:clients.ficha.edit')}</PrimaryButton>
            </div>
          </div>
        </InkBar>
      </div>

      <div className="mt-4" data-tour="sec.clients-ficha.tabs">
        <FichaTabs tabs={tabs} active={tab} onChange={setTab} />
      </div>
      <div className="mt-px">{content}</div>

      {createOpen && (
        <ProjectWindow
          initialClient={{ id: client.id, name: client.name }}
          onClose={() => setCreateOpen(false)}
          onSaved={() => { loadProjects(); onClientChanged(); }}
        />
      )}
    </div>
  );
}
