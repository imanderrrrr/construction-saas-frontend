import {
  FolderOpen, UserPlus, Users, PowerOff, Power,
  Lock, ShieldAlert, Pencil, History, TrendingDown, TrendingUp, FileText,
  Plus, Minus, Trash2, Loader2, AlertCircle, Share2,
} from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Skeleton } from '../ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '../ui/table';
import { toast } from 'sonner';
import { isProjectClosed, CLOSED_PROJECT_MSG } from '../../helpers/project-utils';
import { ClosedProjectBanner } from '../ClosedProjectBanner';
import { ShareSiteLogModal } from './ShareSiteLogModal';
import type { Project, UserForAssign } from './types';
import { fmtUSD, fmtDate } from './helpers';
import { StatusBadge, UserAvatar, RoleBadge } from './badges';
import { IncompleteBanner } from './IncompleteBanner';
import {
  getContractHistory, type ContractHistoryEntry,
  listChangeOrders, createChangeOrder, deleteChangeOrder, type ChangeOrderEntry,
} from '../../services/projects';
import { PunchList } from '../punchlist/PunchList';
import { useSiteLogFeature } from '../../hooks/useSiteLogFeature';

export function ProjectDetailsView({ project, allUsers, usersLoading, onBack, onAssign, onToggleStatus, onCloseProject, onEdit }: {
  project: Project; allUsers: UserForAssign[]; usersLoading: boolean;
  onBack: () => void;
  onAssign: () => void; onToggleStatus: () => void; onCloseProject: () => void; onEdit: () => void;
}) {
  const { t, i18n } = useTranslation(['admin', 'common', 'clientView']);
  const [shareOpen, setShareOpen] = useState(false);
  const assignedUsers = project.assignedUserIds
    .map(id => allUsers.find(u => u.id === id))
    .filter(Boolean) as UserForAssign[];
  const closed = isProjectClosed(project);

  // Punch list rides the same plan feature as the bitácora / client portal.
  const { enabled: punchEnabled } = useSiteLogFeature();
  const punchAssignees = allUsers
    .filter(u => u.status === 'ACTIVE' && (u.role === 'WORKER' || u.role === 'SUPERVISOR' || u.role === 'SUBCONTRACTOR'))
    .map(u => ({ id: u.id, name: u.fullName || u.username }));

  const [history, setHistory] = useState<ContractHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(false);
  const [changeOrders, setChangeOrders] = useState<ChangeOrderEntry[]>([]);
  const [cosLoading, setCosLoading] = useState(false);
  const [cosError, setCosError] = useState(false);

  // Change order form state
  const [coDesc, setCoDesc] = useState('');
  const [coAmount, setCoAmount] = useState('');
  const [coSign, setCoSign] = useState<'+' | '-'>('+');
  const [coSaving, setCoSaving] = useState(false);

  const loadChangeOrders = useCallback(() => {
    setCosLoading(true);
    setCosError(false);
    listChangeOrders(project.id)
      .then(setChangeOrders)
      .catch(() => setCosError(true))
      .finally(() => setCosLoading(false));
  }, [project.id]);

  const loadHistory = useCallback(() => {
    setHistoryLoading(true);
    setHistoryError(false);
    getContractHistory(project.id)
      .then(setHistory)
      .catch(() => setHistoryError(true))
      .finally(() => setHistoryLoading(false));
  }, [project.id]);

  useEffect(() => {
    if (project.originalContractCents != null) {
      loadHistory();
      loadChangeOrders();
    }
  }, [project.originalContractCents, loadHistory, loadChangeOrders]);

  const handleCreateCO = async () => {
    const cents = Math.round(parseFloat(coAmount.replace(/[^0-9.]/g, '')) * 100);
    if (!coDesc.trim() || isNaN(cents) || cents <= 0) return;
    const signedCents = coSign === '+' ? cents : -cents;
    setCoSaving(true);
    try {
      await createChangeOrder(project.id, { description: coDesc.trim(), amountCents: signedCents });
      setCoDesc('');
      setCoAmount('');
      loadChangeOrders();
      // Refresh contract history too
      getContractHistory(project.id).then(setHistory).catch(err => toast.error(err?.message));
      toast.success(t('admin:changeOrders.created'));
    } catch {
      toast.error(t('admin:changeOrders.createFailed'));
    } finally {
      setCoSaving(false);
    }
  };

  const handleDeleteCO = async (coId: number) => {
    try {
      await deleteChangeOrder(project.id, coId);
      loadChangeOrders();
      getContractHistory(project.id).then(setHistory).catch(err => toast.error(err?.message));
      toast.success(t('admin:changeOrders.deleted'));
    } catch {
      toast.error(t('admin:changeOrders.deleteFailed'));
    }
  };

  const coTotal = changeOrders.reduce((s, co) => s + co.amountCents, 0);
  const revisedCents = project.originalContractCents != null ? project.originalContractCents + coTotal : null;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[#71717A]">
        <button onClick={onBack} className="hover:text-[#0A0A0A] transition-colors font-medium">{t('admin:projectDetails.breadcrumb')}</button>
        <span>/</span>
        <span className="text-[#0A0A0A] truncate max-w-xs">{project.name}</span>
      </div>

      {/* Closed project banner */}
      {closed && <ClosedProjectBanner />}

      {/* Incompleteness banner */}
      {!closed && <IncompleteBanner project={project} />}

      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-[#F97316]/10 rounded-xl flex items-center justify-center flex-shrink-0">
            <FolderOpen className="w-6 h-6 text-[#F97316]" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-[#0A0A0A]">{project.name}</h2>
            <div className="flex items-center gap-2 mt-2">
              <StatusBadge status={project.status} />
              <span className="text-xs text-[#71717A]">{t('admin:projectDetails.createdLabel')} {fmtDate(project.createdAt, i18n.language)}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!closed && (
            <>
              <Button onClick={onEdit} variant="outline"
                className="gap-2 h-9 border-[#D4D4D8] text-[#0A0A0A]">
                <Pencil className="w-3.5 h-3.5" />{t('common:buttons.edit')}
              </Button>
              <Button onClick={() => setShareOpen(true)} variant="outline"
                className="gap-2 h-9 border-[#D4D4D8] text-[#0A0A0A]">
                <Share2 className="w-3.5 h-3.5" />{t('clientView:share.button')}
              </Button>
              <Button onClick={onAssign}
                className="bg-[#F97316] hover:bg-[#C2410C] text-white gap-2 h-9">
                <UserPlus className="w-4 h-4" />{t('admin:projectDetails.assignUsers')}
              </Button>
              <Button variant="outline" size="sm" onClick={onToggleStatus}
                className={`gap-2 h-9 ${project.status === 'ACTIVE' ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'}`}>
                {project.status === 'ACTIVE' ? <><PowerOff className="w-3.5 h-3.5" />{t('admin:projectDetails.setInactive')}</> : <><Power className="w-3.5 h-3.5" />{t('admin:projectDetails.setActive')}</>}
              </Button>
              <Button variant="outline" size="sm" onClick={onCloseProject}
                className="gap-2 h-9 border-red-300 text-red-700 hover:bg-red-50 bg-red-50/50">
                <ShieldAlert className="w-3.5 h-3.5" />{t('admin:projectDetails.closeProject')}
              </Button>
            </>
          )}
          {closed && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-700 border border-red-200" title={CLOSED_PROJECT_MSG}>
              <Lock className="w-3.5 h-3.5" />{t('admin:projectDetails.allActionsBlocked')}
            </span>
          )}
        </div>
      </div>

      {/* Summary Card */}
      <div className="bg-white rounded-xl border border-[#D4D4D8] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#D4D4D8] bg-[#FAFAFA]/50">
          <h3 className="text-sm font-semibold text-[#0A0A0A]">{t('admin:projectDetails.summary')}</h3>
        </div>
        <div className="p-6 space-y-0 divide-y divide-[#FAFAFA]">
          {[
            { label: t('admin:projectDetails.field.projectName'), value: <span className="text-sm text-[#0A0A0A]">{project.name}</span> },
            { label: t('admin:projectDetails.field.status'), value: <StatusBadge status={project.status} /> },
            { label: t('admin:projectDetails.field.client'), value: <span className="text-sm text-[#0A0A0A]">{project.clientName || <span className="text-[#71717A] italic">{t('admin:projectDetails.notAssigned')}</span>}</span> },
            { label: t('admin:projectDetails.field.costCode'), value: <span className="text-sm font-mono text-[#0A0A0A]">{project.costCode || <span className="text-[#71717A] italic font-sans">{t('admin:projectDetails.notSet')}</span>}</span> },
            { label: t('admin:projectDetails.field.originalContract'), value: <span className="text-sm font-mono text-[#0A0A0A]">{fmtUSD(project.originalContractCents)}</span> },
            { label: t('admin:projectDetails.field.revisedContract'), value: revisedCents != null ? (
              <span className={`text-sm font-mono font-semibold ${revisedCents !== project.originalContractCents ? 'text-[#F97316]' : 'text-[#0A0A0A]'}`}>
                {fmtUSD(revisedCents)}
              </span>
            ) : <span className="text-sm text-[#71717A]">—</span> },
            { label: t('admin:projectDetails.field.remainingBudget'), value: project.contractAmountCents != null ? (
              <span className={`text-sm font-mono font-semibold ${project.contractAmountCents < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {fmtUSD(project.contractAmountCents)}
              </span>
            ) : <span className="text-sm text-[#71717A]">—</span> },
            { label: t('admin:projectDetails.field.address'), value: <span className="text-sm text-[#71717A]">{project.address || '—'}</span> },
            { label: t('admin:projectDetails.field.location'), value: project.latitude != null ? <span className="text-sm font-mono text-[#71717A]">{project.latitude}, {project.longitude}</span> : <span className="text-sm text-[#71717A]">—</span> },
            { label: t('admin:projectDetails.field.geofence'), value: <span className="text-sm text-[#71717A]">{t('admin:projectDetails.geofenceRadius', { meters: project.geofenceRadiusMeters })}</span> },
            { label: t('admin:projectDetails.field.createdAt'), value: <span className="text-sm text-[#71717A]">{fmtDate(project.createdAt, i18n.language)}</span> },
            { label: t('admin:projectDetails.field.projectId'), value: <span className="font-mono text-sm text-[#71717A]">#{project.id}</span> },
            { label: t('admin:projectDetails.field.assigned'), value: <span className="text-sm text-[#71717A]">{t('admin:projectDetails.userCount', { count: project.assignedUserIds.length })}</span> },
          ].map(row => (
            <div key={row.label} className="flex items-start justify-between py-3">
              <span className="text-xs font-medium text-[#71717A] uppercase tracking-wide w-28 flex-shrink-0 pt-0.5">{row.label}</span>
              <div className="flex-1 text-right">{row.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Change Orders Card */}
      {project.originalContractCents != null && (
        <div className="bg-white rounded-xl border border-[#D4D4D8] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#D4D4D8] bg-[#FAFAFA]/50 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#F97316]" />
            <h3 className="text-sm font-semibold text-[#0A0A0A]">{t('admin:changeOrders.title')}</h3>
          </div>
          <div className="p-6 space-y-6">
            {/* Original + Revised sums */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-[#FAFAFA] rounded-lg p-4">
                <p className="text-xs font-medium text-[#71717A] uppercase tracking-wide mb-1">{t('admin:changeOrders.originalSum')}</p>
                <p className="text-lg font-bold font-mono text-[#0A0A0A]">{fmtUSD(project.originalContractCents)}</p>
              </div>
              <div className={`rounded-lg p-4 ${coTotal !== 0 ? 'bg-[#F97316]/5 border border-[#F97316]/20' : 'bg-[#FAFAFA]'}`}>
                <p className="text-xs font-medium text-[#71717A] uppercase tracking-wide mb-1">{t('admin:changeOrders.revisedSum')}</p>
                <p className={`text-lg font-bold font-mono ${coTotal !== 0 ? 'text-[#F97316]' : 'text-[#0A0A0A]'}`}>{fmtUSD(revisedCents)}</p>
              </div>
            </div>

            {/* Change orders list */}
            {cosLoading && (
              <div className="space-y-3">
                {Array.from({ length: 2 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            )}
            {!cosLoading && cosError && (
              <div className="flex items-center justify-between gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                <span className="flex items-center gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0" />{t('admin:changeOrders.loadError', "Couldn't load change orders.")}</span>
                <button type="button" onClick={loadChangeOrders} className="text-xs font-medium text-red-700 hover:text-red-900 underline shrink-0">{t('common:buttons.retry')}</button>
              </div>
            )}
            {!cosLoading && !cosError && changeOrders.length === 0 && (
              <div className="flex flex-col items-center justify-center py-6">
                <div className="w-11 h-11 bg-[#FAFAFA] rounded-full flex items-center justify-center mb-3">
                  <FileText className="w-5 h-5 text-[#D4D4D8]" />
                </div>
                <p className="text-sm font-medium text-[#0A0A0A]">{t('admin:changeOrders.noOrders')}</p>
                <p className="text-xs text-[#71717A] mt-1">{t('admin:changeOrders.noOrdersHint')}</p>
              </div>
            )}
            {!cosLoading && !cosError && changeOrders.length > 0 && (
              <div className="space-y-2">
                {changeOrders.map(co => (
                  <div key={co.id} className="flex items-center justify-between px-4 py-3 bg-[#FAFAFA] rounded-lg border border-[#D4D4D8]/50">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#0A0A0A] truncate">{co.description}</p>
                      <p className="text-xs text-[#71717A] mt-0.5">{fmtDate(co.createdAt, i18n.language)}{co.createdBy ? ` · ${co.createdBy}` : ''}</p>
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                      <span className={`text-sm font-mono font-semibold ${co.amountCents >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {co.amountCents >= 0 ? '+' : ''}{fmtUSD(co.amountCents)}
                      </span>
                      {!closed && (
                        <button
                          onClick={() => handleDeleteCO(co.id)}
                          className="p-1.5 rounded-md text-[#71717A] hover:text-red-600 hover:bg-red-50 transition-colors"
                          title={t('common:buttons.delete')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add CO form */}
            {!closed && (
              <div className="border-t border-[#D4D4D8] pt-5">
                <h4 className="text-sm font-semibold text-[#0A0A0A] mb-3">{t('admin:changeOrders.addTitle')}</h4>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs font-medium text-[#71717A]">{t('admin:changeOrders.description')}</Label>
                    <Input
                      value={coDesc}
                      onChange={e => setCoDesc(e.target.value)}
                      placeholder={t('admin:changeOrders.descriptionPlaceholder')}
                      className="mt-1"
                    />
                  </div>
                  <div className="flex gap-3 items-end">
                    <div className="flex-1">
                      <Label className="text-xs font-medium text-[#71717A]">{t('admin:changeOrders.amount')}</Label>
                      <Input
                        value={coAmount}
                        onChange={e => setCoAmount(e.target.value)}
                        placeholder={t('admin:changeOrders.amountPlaceholder')}
                        className="mt-1 font-mono"
                        type="text"
                        inputMode="decimal"
                      />
                    </div>
                    <div className="flex rounded-lg border border-[#D4D4D8] overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setCoSign('+')}
                        className={`px-3 py-2 text-sm font-semibold flex items-center gap-1 transition-colors ${coSign === '+' ? 'bg-emerald-50 text-emerald-700 border-r border-[#D4D4D8]' : 'text-[#71717A] hover:bg-[#FAFAFA] border-r border-[#D4D4D8]'}`}
                      >
                        <Plus className="w-3.5 h-3.5" />{t('admin:changeOrders.increase')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setCoSign('-')}
                        className={`px-3 py-2 text-sm font-semibold flex items-center gap-1 transition-colors ${coSign === '-' ? 'bg-red-50 text-red-700' : 'text-[#71717A] hover:bg-[#FAFAFA]'}`}
                      >
                        <Minus className="w-3.5 h-3.5" />{t('admin:changeOrders.decrease')}
                      </button>
                    </div>
                  </div>
                  <Button
                    onClick={handleCreateCO}
                    disabled={coSaving || !coDesc.trim() || !coAmount.trim()}
                    className="bg-[#F97316] hover:bg-[#C2410C] text-white gap-2"
                  >
                    {coSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    {coSaving ? t('admin:changeOrders.saving') : t('admin:changeOrders.save')}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Contract History Card */}
      {project.originalContractCents != null && (
        <div className="bg-white rounded-xl border border-[#D4D4D8] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#D4D4D8] bg-[#FAFAFA]/50 flex items-center gap-2">
            <History className="w-4 h-4 text-[#F97316]" />
            <h3 className="text-sm font-semibold text-[#0A0A0A]">{t('admin:projectDetails.contractHistory')}</h3>
          </div>
          <div className="p-6">
            {historyLoading && (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            )}
            {!historyLoading && historyError && (
              <div className="flex items-center justify-between gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                <span className="flex items-center gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0" />{t('admin:projectDetails.historyError', "Couldn't load contract history.")}</span>
                <button type="button" onClick={loadHistory} className="text-xs font-medium text-red-700 hover:text-red-900 underline shrink-0">{t('common:buttons.retry')}</button>
              </div>
            )}
            {!historyLoading && !historyError && history.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8">
                <div className="w-11 h-11 bg-[#FAFAFA] rounded-full flex items-center justify-center mb-3">
                  <FileText className="w-5 h-5 text-[#D4D4D8]" />
                </div>
                <p className="text-sm font-medium text-[#0A0A0A]">{t('admin:projectDetails.noHistory')}</p>
                <p className="text-xs text-[#71717A] mt-1">{t('admin:projectDetails.noHistoryHint')}</p>
              </div>
            )}
            {!historyLoading && !historyError && history.length > 0 && (
              <div className="overflow-x-auto -mx-6 -mb-6">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#FAFAFA] border-b border-[#D4D4D8] hover:bg-[#FAFAFA]">
                      <TableHead className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wider pl-6">{t('admin:projectDetails.historyTable.date')}</TableHead>
                      <TableHead className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wider">{t('admin:projectDetails.historyTable.type')}</TableHead>
                      <TableHead className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wider">{t('admin:projectDetails.historyTable.amount')}</TableHead>
                      <TableHead className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wider">{t('admin:projectDetails.historyTable.balance')}</TableHead>
                      <TableHead className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wider pr-6">{t('admin:projectDetails.historyTable.description')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map(entry => (
                      <TableRow key={entry.id} className="border-b border-[#D4D4D8]/40 hover:bg-[#FAFAFA]">
                        <TableCell className="pl-6 py-3">
                          <span className="text-xs text-[#71717A]">{fmtDate(entry.createdAt, i18n.language)}</span>
                        </TableCell>
                        <TableCell className="py-3">
                          {entry.changeType === 'INITIAL_ASSIGNMENT' ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#F97316] bg-[#F97316]/10 px-2 py-0.5 rounded-full">
                              <FileText className="w-3 h-3" />{t('admin:projectDetails.historyType.initial')}
                            </span>
                          ) : entry.changeType === 'CHANGE_ORDER' ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                              <TrendingUp className="w-3 h-3" />{t('admin:projectDetails.historyType.changeOrder')}
                            </span>
                          ) : entry.changeType === 'CHANGE_ORDER_REVERSED' ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#71717A] bg-[#FAFAFA] px-2 py-0.5 rounded-full">
                              <AlertCircle className="w-3 h-3" />{t('admin:projectDetails.historyType.changeOrderReversed')}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                              <TrendingDown className="w-3 h-3" />{t('admin:projectDetails.historyType.deduction')}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="py-3">
                          <span className={`text-sm font-mono font-semibold ${entry.amountCents >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {entry.amountCents >= 0 ? '+' : '-'}{fmtUSD(Math.abs(entry.amountCents))}
                          </span>
                        </TableCell>
                        <TableCell className="py-3">
                          <span className={`text-sm font-mono font-semibold ${entry.balanceAfterCents < 0 ? 'text-red-600' : 'text-[#0A0A0A]'}`}>
                            {fmtUSD(entry.balanceAfterCents)}
                          </span>
                        </TableCell>
                        <TableCell className="py-3 pr-6">
                          <span className="text-xs text-[#71717A] max-w-xs truncate block">{entry.description || '—'}</span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Assigned Users Card */}
      <div className="bg-white rounded-xl border border-[#D4D4D8] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#D4D4D8] bg-[#FAFAFA]/50 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#0A0A0A]">{t('admin:projectDetails.assignedUsers')}</h3>
          <div className="flex items-center gap-2">
            {!closed && (
              <Button size="sm" onClick={onAssign}
                className="h-7 text-xs bg-[#F97316] hover:bg-[#C2410C] text-white gap-1">
                <UserPlus className="w-3 h-3" />{t('admin:projectDetails.assign')}
              </Button>
            )}
          </div>
        </div>
        <div className="p-6">
          {usersLoading && (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="w-9 h-9 rounded-full" />
                  <div className="flex-1 space-y-1.5"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-20" /></div>
                  <Skeleton className="h-6 w-24 rounded-full" />
                </div>
              ))}
            </div>
          )}
          {!usersLoading && assignedUsers.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10">
              <div className="w-11 h-11 bg-[#FAFAFA] rounded-full flex items-center justify-center mb-3">
                <Users className="w-5 h-5 text-[#D4D4D8]" />
              </div>
              <p className="text-sm font-medium text-[#0A0A0A]">{t('admin:projectDetails.noUsersAssigned')}</p>
              <p className="text-xs text-[#71717A] mt-1">{t('admin:projectDetails.noUsersAssignedHint')}</p>
            </div>
          )}
          {!usersLoading && assignedUsers.length > 0 && (
            <div className="overflow-x-auto -mx-6 -mb-6">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#FAFAFA] border-b border-[#D4D4D8] hover:bg-[#FAFAFA]">
                    <TableHead className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wider pl-6">{t('admin:projectDetails.usersTable.username')}</TableHead>
                    <TableHead className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wider">{t('admin:projectDetails.usersTable.fullName')}</TableHead>
                    <TableHead className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wider">{t('admin:projectDetails.usersTable.role')}</TableHead>
                    <TableHead className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wider pr-6">{t('admin:projectDetails.usersTable.status')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignedUsers.map(user => (
                    <TableRow key={user.id} className="border-b border-[#D4D4D8]/40 hover:bg-[#FAFAFA]">
                      <TableCell className="pl-6 py-3">
                        <div className="flex items-center gap-2">
                          <UserAvatar user={user} size="sm" />
                          <span className="font-mono text-sm font-semibold text-[#0A0A0A]">{user.username}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-3"><span className="text-sm text-[#71717A]">{user.fullName || '—'}</span></TableCell>
                      <TableCell className="py-3"><RoleBadge role={user.role} /></TableCell>
                      <TableCell className="py-3 pr-6">
                        <span className={`text-xs font-semibold ${user.status === 'ACTIVE' ? 'text-emerald-600' : 'text-[#71717A]'}`}>
                          {t(`common:status.${user.status.toLowerCase()}`)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      {/* Punch list (client portal fase 2) — hidden when the plan lacks the feature */}
      {punchEnabled && (
        <PunchList projects={[{ id: project.id, name: project.name, assignees: punchAssignees }]} />
      )}

      <ShareSiteLogModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        projectId={project.id}
        projectName={project.name}
        clientName={project.clientName ?? null}
      />
    </div>
  );
}
