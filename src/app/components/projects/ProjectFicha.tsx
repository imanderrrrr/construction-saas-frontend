import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, MoreHorizontal, UserPlus } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { cn } from '../ui/utils';
import { isProjectClosed } from '../../helpers/project-utils';
import { useSiteLogFeature } from '../../hooks/useSiteLogFeature';
import { useTourScopeWhileMounted } from '../../lib/tourScope';
import { listPunchItems } from '../../services/punchItems';
import { listRfis } from '../../services/rfis';
import { FOCUS_RING, InkBar, PrimaryButton, TertiaryButton } from '../onboarding/chrome';
import { PunchList } from '../punchlist/PunchList';
import { RfiList } from '../rfi/RfiList';
import type { Project, UserForAssign } from './types';
import { fmtUSD, fmtDate, isIncomplete } from './helpers';
import { IncompleteChip, RoleBadge, StatusBadge, UserAvatar } from './badges';
import { Bone, EmptyWord, Mono, PaperNote } from './bt';
import { LocationMap } from './form/LocationMap';
import { DarkButton, FichaTabs, Figure, LockedPanel, Panel, Row, type FichaTabDef } from './ficha/panel';
import { DineroPanel } from './ficha/DineroPanel';
import { PortalPanel } from './ficha/PortalPanel';

/**
 * The project ficha (Claude Design "Proyectos BuildTrack" fase 2, 03–03J).
 *
 * One ink bar with the identity and the actions, then six subventanas behind
 * tabs: Resumen, Dinero, Equipo, Pendientes, Consultas, Portal. The old
 * details page stacked all of that in one scroll; here each tab says in one
 * sentence what it is for, and the tour of the tab on screen is what the "?"
 * replays (lib/tourScope).
 *
 * Three states change the chrome, never the tabs:
 * - incompleta: an orange notice with what is missing and "Completar ficha";
 *   the money forms stay visible but disabled with the reason.
 * - cerrada: a red notice, "Volver" instead of actions, no forms anywhere;
 *   the six tabs stay navigable because the closed ficha is the archive.
 * - sin plan: Pendientes, Consultas and Portal are padlocked and explain why.
 */

export type FichaTab = 'resumen' | 'dinero' | 'equipo' | 'pendientes' | 'consultas' | 'portal';
const TABS: FichaTab[] = ['resumen', 'dinero', 'equipo', 'pendientes', 'consultas', 'portal'];
/** The three that ride the site-log plan feature. */
const PLAN_TABS: FichaTab[] = ['pendientes', 'consultas', 'portal'];

const MENU_ITEM = 'rounded-none font-bt-mono text-[10px] font-semibold uppercase tracking-[0.1em] px-3.5 py-2.5 cursor-pointer focus:bg-[#F3EEE4]';

export function ProjectFicha({
  project, allUsers, usersLoading, onBack, onAssign, onToggleStatus, onCloseProject, onDelete, onEdit, onPlans, initialTab = 'resumen',
}: {
  project: Project;
  allUsers: UserForAssign[];
  usersLoading: boolean;
  onBack: () => void;
  onAssign: () => void;
  onToggleStatus: () => void;
  onCloseProject: () => void;
  onDelete: () => void;
  onEdit: () => void;
  /** "Ver planes →" on the padlocked tabs; absent = no link. */
  onPlans?: () => void;
  initialTab?: FichaTab;
}) {
  const { t, i18n } = useTranslation(['admin', 'common']);
  const lang = i18n.language;
  const [tab, setTab] = useState<FichaTab>(initialTab);

  const closed = isProjectClosed(project);
  const incomplete = !closed && isIncomplete(project);
  const { enabled: planEnabled, loading: planLoading } = useSiteLogFeature();
  const locked = !planLoading && !planEnabled;

  // The tab on screen owns the tour while the ficha is mounted.
  useTourScopeWhileMounted(`projects-ficha-${tab}`, t(`admin:projectFicha.tab.${tab}`));

  // Tab counters: the crew is a fact, the other two are queues (what still
  // needs a hand). Re-read on every tab change so an action inside a tab
  // moves the number without lifting those lists' state up here.
  const [punchCount, setPunchCount] = useState<number | null>(null);
  const [rfiCount, setRfiCount] = useState<number | null>(null);
  useEffect(() => {
    if (!planEnabled) return;
    let cancelled = false;
    listPunchItems(project.id)
      .then(items => { if (!cancelled) setPunchCount(items.filter(i => i.status !== 'CLOSED').length); })
      .catch(() => { /* the tab just shows no number */ });
    listRfis(project.id)
      .then(items => { if (!cancelled) setRfiCount(items.filter(r => r.ballInCourt === 'COMPANY').length); })
      .catch(() => { /* idem */ });
    return () => { cancelled = true; };
  }, [project.id, planEnabled, tab]);

  const assignedUsers = useMemo(
    () => project.assignedUserIds.map(id => allUsers.find(u => u.id === id)).filter(Boolean) as UserForAssign[],
    [project.assignedUserIds, allUsers],
  );

  const kicker = [
    t('admin:projectFicha.kickerProject', { id: project.id }),
    project.costCode ?? t('admin:projectFicha.noCode'),
    project.clientName ?? t('admin:projectFicha.noClient'),
  ].join(' · ');

  const missing = [
    !project.clientId && t('admin:projectFicha.missing.client'),
    !project.costCode && t('admin:projectFicha.missing.code'),
    (project.originalContractCents == null || project.originalContractCents <= 0) && t('admin:projectFicha.missing.contract'),
  ].filter((x): x is string => !!x);
  const missingList = missing.length > 1
    ? `${missing.slice(0, -1).join(', ')} ${t('admin:projectFicha.missing.and')} ${missing[missing.length - 1]}`
    : missing[0] ?? '';

  const tabs: FichaTabDef<FichaTab>[] = TABS.map(key => ({
    key,
    label: t(`admin:projectFicha.tab.${key}`),
    count: key === 'equipo' ? project.assignedUserIds.length : key === 'pendientes' ? punchCount : key === 'consultas' ? rfiCount : undefined,
    queue: key === 'pendientes' || key === 'consultas',
    locked: locked && PLAN_TABS.includes(key),
  }));

  const hasCoords = project.latitude != null && project.longitude != null;
  const revisedMoved = project.revisedContractCents != null && project.revisedContractCents !== project.originalContractCents;
  const remaining = project.remainingBudgetCents;
  const teamLine = `${t('admin:projectDetails.field.assigned')} · ${t('admin:projectDetails.userCount', { count: project.assignedUserIds.length })}`;
  const punchAssignees = allUsers
    .filter(u => u.status === 'ACTIVE' && (u.role === 'WORKER' || u.role === 'SUPERVISOR' || u.role === 'SUBCONTRACTOR'))
    .map(u => ({ id: u.id, name: u.fullName || u.username }));

  const menuItems = [
    { key: 'toggle', label: project.status === 'ACTIVE' ? t('admin:projectMgmt.setInactive') : t('admin:projectMgmt.setActive'), onClick: onToggleStatus },
    { key: 'close', danger: true, sep: true, label: t('admin:projectMgmt.closeProject'), onClick: onCloseProject },
    { key: 'delete', danger: true, label: t('admin:projectMgmt.deleteProject'), onClick: onDelete },
  ];

  const resumenRows = (
    <div>
      <Row label={t('admin:projectDetails.field.projectName')}><span className="font-semibold">{project.name}</span></Row>
      <Row label={t('admin:projectDetails.field.status')}><StatusBadge status={project.status} /></Row>
      <Row label={t('admin:projectDetails.field.client')} empty={t('admin:projectDetails.notAssigned')}>{project.clientName ?? undefined}</Row>
      <Row label={t('admin:projectDetails.field.costCode')} empty={t('admin:projectDetails.notSet')}>{project.costCode ? <Mono className="text-[12px] tracking-[0.04em]">{project.costCode}</Mono> : undefined}</Row>
      <Row label={t('admin:projectDetails.field.originalContract')} empty={t('admin:projectDetails.notSet')}>
        {project.originalContractCents != null ? <Mono className="text-[12.5px] tabular-nums">{fmtUSD(project.originalContractCents)}</Mono> : undefined}
      </Row>
      <Row label={t('admin:projectDetails.field.revisedContract')} empty="—">
        {project.revisedContractCents != null ? <Mono className={cn('text-[12.5px] font-semibold tabular-nums', revisedMoved && 'text-[#C2410C]')}>{fmtUSD(project.revisedContractCents)}</Mono> : undefined}
      </Row>
      <Row label={t('admin:projectDetails.field.costBudget')} empty={t('admin:projectDetails.notSet')}>
        {project.costBudgetCents != null ? <Mono className="text-[12.5px] font-semibold tabular-nums">{fmtUSD(project.costBudgetCents)}</Mono> : undefined}
      </Row>
      <Row label={t('admin:projectDetails.field.remainingBudget')} empty="—">
        {remaining != null ? <Mono className={cn('text-[12.5px] font-semibold tabular-nums', remaining < 0 ? 'text-[#B3402A]' : 'text-[#0A0A0A]')}>{fmtUSD(remaining)}</Mono> : undefined}
      </Row>
      <Row label={t('admin:projectDetails.field.address')} empty="—">{project.address ?? undefined}</Row>
      <Row label={t('admin:projectDetails.field.location')} empty="—">
        {hasCoords ? <Mono className="text-[12px] tabular-nums">{(project.latitude as number).toFixed(6)}, {(project.longitude as number).toFixed(6)}</Mono> : undefined}
      </Row>
      <Row label={t('admin:projectDetails.field.geofence')}>{t('admin:projectDetails.geofenceRadius', { meters: project.geofenceRadiusMeters })}</Row>
      <Row label={t('admin:projectDetails.field.createdAt')}>{fmtDate(project.createdAt, lang)}</Row>
      <Row label={t('admin:projectDetails.field.projectId')}><Mono className="text-[12px]">#{project.id}</Mono></Row>
    </div>
  );

  const teamBlock = (
    <div data-tour="sec.projects-ficha-resumen.team">
      <div className="flex items-center justify-between gap-3">
        <Mono className="text-[9.5px] font-semibold tracking-[0.12em] text-[#5A5346]">
          {teamLine}{closed && ` · ${t('admin:projectFicha.resumen.noClockIn')}`}
        </Mono>
        <TertiaryButton onClick={() => setTab('equipo')} className="inline-flex items-center gap-1">
          {t('admin:projectFicha.resumen.viewTeam')}<ArrowRight className="w-3 h-3" strokeWidth={2.2} />
        </TertiaryButton>
      </div>
      {usersLoading ? (
        <div className="flex gap-1.5 mt-2.5">{[0, 1, 2].map(i => <Bone key={i} className="w-[26px] h-[26px]" />)}</div>
      ) : assignedUsers.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {assignedUsers.slice(0, 12).map(u => <UserAvatar key={u.id} user={u} size="md" />)}
          {assignedUsers.length > 12 && (
            <span className="w-[26px] h-[26px] flex items-center justify-center border border-[#DBD0BB] font-bt-mono text-[9px] text-[#5A5346]">+{assignedUsers.length - 12}</span>
          )}
        </div>
      ) : (
        <p className="text-[12.5px] italic text-[#A69C8D] mt-2">{t('admin:projectFicha.equipo.emptyTitle')}</p>
      )}
    </div>
  );

  const content = locked && PLAN_TABS.includes(tab) ? (
    <LockedPanel onPlans={onPlans} />
  ) : tab === 'resumen' ? (
    <Panel title={t('admin:projectFicha.tab.resumen')} purpose={closed ? t('admin:projectFicha.purpose.resumenClosed') : t('admin:projectFicha.purpose.resumen')}>
      {closed ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 border border-[#E7E1D5]">
            <Figure value={fmtUSD(project.revisedContractCents)} label={t('admin:projectDetails.field.revisedContract')} className="px-4 py-3.5 border-r border-b md:border-b-0 border-[#E7E1D5]" />
            <Figure value={fmtUSD(project.totalConsumedCents ?? 0)} label={t('admin:projectFicha.dinero.consumed')} className="px-4 py-3.5 md:border-r border-b md:border-b-0 border-[#E7E1D5]" />
            <Figure value={fmtUSD(remaining)} label={t('admin:projectFicha.dinero.balance')} tone={remaining != null && remaining < 0 ? 'red' : 'ink'} className="px-4 py-3.5 border-r border-[#E7E1D5]" />
            <Figure value={fmtUSD(project.outstandingCents)} label={t('admin:projectDetails.billing.outstanding')} className="px-4 py-3.5" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-6 lg:gap-[26px] mt-5">
            <div>
              <Row label={t('admin:projectDetails.field.client')} empty={t('admin:projectDetails.notAssigned')}>{project.clientName ?? undefined}</Row>
              <Row label={t('admin:projectDetails.field.costCode')} empty={t('admin:projectDetails.notSet')}>{project.costCode ? <Mono className="text-[12px] tracking-[0.04em]">{project.costCode}</Mono> : undefined}</Row>
              <Row label={t('admin:projectDetails.field.costBudget')} empty={t('admin:projectDetails.notSet')}>
                {project.costBudgetCents != null ? <Mono className="text-[12.5px] font-semibold tabular-nums">{fmtUSD(project.costBudgetCents)}</Mono> : undefined}
              </Row>
              <Row label={t('admin:projectDetails.field.address')} empty="—">{project.address ?? undefined}</Row>
              <Row label={t('admin:projectDetails.field.createdAt')}>{fmtDate(project.createdAt, lang)}</Row>
              <Row label={t('admin:projectDetails.field.projectId')}><Mono className="text-[12px]">#{project.id}</Mono></Row>
            </div>
            <div className="flex flex-col gap-4">
              {teamBlock}
              <Mono className="text-[9.5px] tracking-[0.14em] text-[#B3402A] font-semibold">{t('admin:projectFicha.closed.stamp')}</Mono>
            </div>
          </div>
        </>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-6 lg:gap-[26px]">
          {resumenRows}
          <div className="flex flex-col gap-4">
            <div data-tour="sec.projects-ficha-resumen.map">
              {hasCoords ? (
                <LocationMap
                  readOnly
                  lat={String(project.latitude)}
                  lng={String(project.longitude)}
                  radius={project.geofenceRadiusMeters}
                  stamp={t('admin:projectFicha.resumen.readOnlyStamp', { meters: project.geofenceRadiusMeters.toLocaleString('en-US') })}
                  className="h-[200px] lg:h-[260px]"
                />
              ) : (
                <div className="h-[200px] lg:h-[260px] bg-[#FAF7F0] border border-[#DBD0BB] flex flex-col items-center justify-center text-center px-6">
                  <div className="font-bt-display font-extrabold uppercase text-[24px] leading-none text-[#CDBFA6]">{t('admin:projectFicha.resumen.noLocation')}</div>
                  <p className="text-[12.5px] text-[#8A8175] mt-2">{t('admin:projectFicha.resumen.noLocationHint')}</p>
                </div>
              )}
            </div>
            {teamBlock}
          </div>
        </div>
      )}
    </Panel>
  ) : tab === 'dinero' ? (
    <DineroPanel project={project} closed={closed} incomplete={incomplete} lang={lang} />
  ) : tab === 'equipo' ? (
    <Panel
      title={t('admin:projectFicha.tab.equipo')}
      purpose={t('admin:projectFicha.purpose.equipo')}
      actions={!closed && (
        <PrimaryButton onClick={onAssign} className="px-[15px] py-[10px] text-[10px] gap-1.5" data-tour="sec.projects-ficha-equipo.assign">
          <UserPlus className="w-3.5 h-3.5" strokeWidth={2} />{t('admin:projectDetails.assignUsers')}
        </PrimaryButton>
      )}
    >
      {closed && (
        <Mono className="block text-[9.5px] tracking-[0.12em] text-[#8A8175] mb-3">
          {t('admin:projectDetails.userCount', { count: project.assignedUserIds.length })} · {t('admin:projectFicha.resumen.noClockIn')}
        </Mono>
      )}
      {usersLoading ? (
        <div className="flex flex-col gap-2"><Bone className="h-10 w-full" /><Bone className="h-10 w-full" /><Bone className="h-10 w-full" /></div>
      ) : assignedUsers.length === 0 ? (
        <EmptyWord
          word={t('admin:projectFicha.equipo.emptyWord')}
          title={t('admin:projectFicha.equipo.emptyTitle')}
          hint={t('admin:projectFicha.equipo.emptyHint')}
          className="border-0 py-9"
        />
      ) : (
        <div data-tour="sec.projects-ficha-equipo.table">
          <div className="hidden md:grid grid-cols-[1.2fr_1.4fr_1fr_.8fr] gap-3 bg-[#FBF8F2] border-y border-[#E7E1D5] px-3 py-2">
            {[t('admin:projectDetails.usersTable.username'), t('admin:projectDetails.usersTable.fullName'), t('admin:projectDetails.usersTable.role'), t('admin:projectDetails.usersTable.status')].map(h => (
              <Mono key={h} className="text-[9.5px] tracking-[0.13em] text-[#8A8175]">{h}</Mono>
            ))}
          </div>
          {assignedUsers.map(user => (
            <div key={user.id} className="grid grid-cols-[1fr_auto] md:grid-cols-[1.2fr_1.4fr_1fr_.8fr] gap-x-3 gap-y-1 items-center px-3 py-2.5 border-b border-[#F0EBE1] hover:bg-[#FBF8F2]">
              <div className="flex items-center gap-2 min-w-0">
                <UserAvatar user={user} size="sm" />
                <Mono className="text-[11.5px] font-semibold text-[#0A0A0A] normal-case truncate">@{user.username}</Mono>
              </div>
              <span className="text-[13.5px] text-[#0A0A0A] truncate col-start-1 md:col-auto">{user.fullName || '—'}</span>
              <div className="row-start-1 col-start-2 md:row-auto md:col-auto justify-self-end md:justify-self-start"><RoleBadge role={user.role} /></div>
              <Mono className={cn('text-[9.5px] tracking-[0.1em] col-start-1 md:col-auto', user.status === 'ACTIVE' ? 'text-[#0A0A0A]' : 'text-[#8A8175]')}>
                {t(`common:status.${user.status.toLowerCase()}`)}
              </Mono>
            </div>
          ))}
        </div>
      )}
    </Panel>
  ) : tab === 'pendientes' ? (
    <PunchList projects={[{ id: project.id, name: project.name, assignees: punchAssignees }]} />
  ) : tab === 'consultas' ? (
    <RfiList projects={[{ id: project.id, name: project.name }]} />
  ) : (
    <PortalPanel projectId={project.id} clientName={project.clientName} readOnly={closed} />
  );

  return (
    <div className="max-w-[1206px]">
      {/* Breadcrumb — also the way back. */}
      <nav aria-label={t('admin:projectDetails.breadcrumb')} className="mb-3.5">
        <button
          type="button"
          onClick={onBack}
          className={cn('group inline-flex items-center gap-2 font-bt-mono text-[10px] font-semibold uppercase tracking-[0.13em] text-[#5A5346] hover:text-[#C2410C] max-w-full', FOCUS_RING)}
        >
          <ArrowLeft className="w-3.5 h-3.5 text-[#C2410C]" strokeWidth={2.2} />
          <span>{t('admin:projectDetails.breadcrumb')}</span>
          <span className="text-[#B4A992]">/</span>
          <span className="text-[#0A0A0A] group-hover:text-[#C2410C] truncate">{project.name}</span>
        </button>
      </nav>

      {/* Ink bar */}
      <div data-tour="sec.projects-ficha-resumen.bar">
        <InkBar grid={26} className="px-4 py-4 md:px-5 md:pt-4 md:pb-[18px]">
          <div className="relative flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="min-w-0">
              <Mono className="block text-[10px] font-semibold tracking-[0.14em] text-[#F97316] truncate">{kicker}</Mono>
              <h2 className="font-bt-display font-extrabold uppercase text-[28px] md:text-[38px] leading-none tracking-[0.01em] mt-1.5 break-words">{project.name}</h2>
              <div className="flex flex-wrap items-center gap-2 mt-2.5">
                <StatusBadge status={project.status} className={cn(project.status === 'CLOSED' && 'bg-[#F5F1E8] text-[#0A0A0A]', project.status === 'INACTIVE' && 'border-[rgba(245,241,232,0.4)] text-[#F5F1E8]')} />
                {incomplete && <IncompleteChip />}
                <Mono className="text-[10px] tracking-[0.1em] text-[rgba(245,241,232,0.7)]">{t('admin:projectFicha.created', { date: fmtDate(project.createdAt, lang) })}</Mono>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 md:justify-end flex-shrink-0">
              {closed ? (
                <DarkButton onClick={onBack} className="gap-1.5"><ArrowLeft className="w-3.5 h-3.5" strokeWidth={2} />{t('admin:projectFicha.backToList')}</DarkButton>
              ) : (
                <>
                  <DarkButton onClick={onEdit} className="order-2 md:order-1 flex-1 md:flex-none py-3 md:py-[10px]">{t('common:buttons.edit')}</DarkButton>
                  {project.clientId != null && !locked && (
                    <DarkButton onClick={() => setTab('portal')} className="hidden md:inline-flex md:order-2">{t('admin:projectFicha.share')}</DarkButton>
                  )}
                  <PrimaryButton onClick={onAssign} className="order-1 md:order-3 flex-1 md:flex-none px-[15px] py-3 md:py-[10px] text-[10px] gap-1.5">
                    <UserPlus className="w-3.5 h-3.5" strokeWidth={2} />
                    <span className="md:hidden">{t('admin:projectFicha.assignShort')}</span>
                    <span className="hidden md:inline">{t('admin:projectDetails.assignUsers')}</span>
                  </PrimaryButton>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label={t('admin:projectFicha.more')}
                        className={cn('order-3 md:order-4 w-8 h-8 md:w-8 md:h-8 flex items-center justify-center border border-[rgba(245,241,232,0.25)] text-[#F5F1E8] hover:border-[#F97316] hover:text-[#F97316] transition-colors flex-shrink-0', FOCUS_RING)}
                      >
                        <MoreHorizontal className="w-4 h-4" strokeWidth={2} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[236px] rounded-none border-[#CDBFA6] p-0 shadow-[0_16px_48px_rgba(23,19,15,0.3)]">
                      <DropdownMenuLabel className="font-bt-mono text-[9.5px] font-normal uppercase tracking-[0.14em] text-[#8A8175] px-3.5 pt-2.5 pb-2 border-b border-[#EDE7DB] truncate">
                        {project.name}
                      </DropdownMenuLabel>
                      {menuItems.map(it => (
                        <DropdownMenuItem
                          key={it.key}
                          onClick={it.onClick}
                          className={cn(MENU_ITEM, it.danger ? 'text-[#B3402A] focus:text-[#B3402A]' : 'text-[#0A0A0A]', it.sep && 'border-t border-[#EDE7DB]')}
                        >
                          {it.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}
            </div>
          </div>
        </InkBar>
      </div>

      {/* Notices: something to do (orange) or nothing can be done (red). */}
      {incomplete && (
        <PaperNote tone="orange" className="mt-3.5 flex flex-col md:flex-row md:items-center md:justify-between gap-3 !py-3.5 !px-4">
          <div>
            <p className="text-[15px] font-semibold text-[#0A0A0A]">{t('admin:projectFicha.incomplete.title', { list: missingList })}</p>
            <p className="text-[13.5px] leading-[1.5] text-[#5A5346] mt-0.5">{t('admin:projectFicha.incomplete.body')}</p>
          </div>
          <TertiaryButton onClick={onEdit} className="flex-shrink-0">{t('admin:projectMgmt.row.completeRecord')}</TertiaryButton>
        </PaperNote>
      )}
      {closed && (
        <PaperNote tone="red" className="mt-3.5 !py-3.5 !px-4">
          <p className="text-[15px] font-semibold text-[#0A0A0A]">{t('admin:projectFicha.closed.title', { date: fmtDate(project.updatedAt ?? project.createdAt, lang) })}</p>
          <p className="text-[13.5px] leading-[1.5] text-[#5A5346] mt-0.5">{t('admin:projectFicha.closed.body')}</p>
        </PaperNote>
      )}

      {/* Tabs + the subventana on screen */}
      <div className="mt-3.5">
        <FichaTabs tabs={tabs} active={tab} onChange={setTab} />
        {content}
      </div>
    </div>
  );
}
