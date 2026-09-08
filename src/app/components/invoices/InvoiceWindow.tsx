import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ArrowRight, FileText, Loader2, Minus, Plus } from 'lucide-react';

import { cn } from '../ui/utils';
import { useTourScopeWhileMounted } from '../../lib/tourScope';
import { businessToday } from '../../helpers/dateTime';
import { FIELD_LIMITS } from '../../../shared/fieldLimits';
import { CloseButton, FOCUS_RING, InkBar, SecondaryButton, TertiaryButton } from '../onboarding/chrome';
import { FieldError, FieldHint, FieldLabel, INPUT, INPUT_ERROR, INPUT_MONO, Mono, PaperNote } from '../projects/bt';
import { createReceivable, type DocumentType, type Receivable } from '../../services/finance';
import { listProjects, type ProjectResponse } from '../../services/projects';
import { listClients } from '../../services/clients';
import { loadInvoiceIssuer } from '../../services/invoiceBranding';
import {
  invoicePdfPreviewUrl, downloadInvoicePdf,
  type InvoiceIssuerPdf, type InvoicePdfData,
} from '../../helpers/exportInvoicePdf';
import { SearchSelect, type PickerOption } from './SearchSelect';
import { ceilingOf, fmtCents, fmtMoney, submitError, type InvoiceSubmitError } from './bits';

/**
 * Emitir un documento — the create window (Claude Design "Facturas
 * BuildTrack", boards 02–05).
 *
 * What the old screen did not do, and this does:
 *
 *  · It shows the **billable ceiling** the moment a jobsite is chosen. The
 *    server compares every invoice against `revisedContractCents −
 *    invoicedCents` and quotes the remainder back inside a 400 — in English,
 *    after the whole document has been typed. Both figures ride on the
 *    project, so the number can be on screen before the first line item.
 *  · It offers **only jobsites that can actually be invoiced**. A closed one
 *    is refused with PROJECT_CLOSED and one missing its client or cost code
 *    with PROJECT_INCOMPLETE_FOR_ACCOUNTING; both used to sit in the list.
 *  · It never prints a number that does not exist. The preview used to stamp
 *    the placeholder "Auto-generado" where the number goes and offer
 *    "Descargar PDF" beside it, so a client could be sent a document that no
 *    system had ever issued. The PDF now downloads once the document is
 *    saved, carrying the number the server assigned.
 *  · A quantity of 0 stays 0. `parseFloat(q) || 1` turned it into 1 in
 *    silence, because 0 is falsy — the row is flagged instead.
 */

interface DraftLine {
  description: string;
  quantity: string;
  unitPrice: string;
}

const EMPTY_LINE: DraftLine = { description: '', quantity: '1', unitPrice: '' };
const OTHER = '__other__';

/** dd days after an ISO date, as an ISO date. */
function plusDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function num(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

export function InvoiceWindow({ onClose, onCreated, onOpenBranding }: {
  onClose: () => void;
  onCreated: (created: Receivable) => void;
  /** Admin only — finance has no invoice-template screen in its menu. */
  onOpenBranding?: () => void;
}) {
  const { t, i18n } = useTranslation(['finance', 'common']);
  const lang = i18n.language;
  useTourScopeWhileMounted('invoices-emitir', t('finance:invoice.window.title'));

  const [docType, setDocType] = useState<DocumentType>('INVOICE');
  const isCO = docType === 'CHANGE_ORDER_REQUEST';

  const [number, setNumber] = useState('');
  const [issuedDate, setIssuedDate] = useState(businessToday);
  const [dueDate, setDueDate] = useState(() => plusDays(businessToday(), 30));
  const [client, setClient] = useState<PickerOption | null>(null);
  const [clientCustom, setClientCustom] = useState('');
  const [project, setProject] = useState<ProjectResponse | null>(null);
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([{ ...EMPTY_LINE }]);
  const [discount, setDiscount] = useState('');
  const [taxRate, setTaxRate] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<InvoiceSubmitError | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [touched, setTouched] = useState(false);

  /* ── Totals ─────────────────────────────────────────────────────────── */

  const parsedLines = useMemo(() => lines.map(line => {
    const quantity = num(line.quantity);
    const unitPrice = num(line.unitPrice);
    const blank = !line.description.trim() && !line.quantity.trim() && !line.unitPrice.trim();
    return {
      // The raw strings stay exactly as typed — the inputs are controlled by
      // them, so a half-written "1." must not be rewritten under the cursor.
      raw: line,
      quantity,
      unitPrice,
      blank,
      // 0 is a real answer and stays 0; it just cannot be billed. The old
      // `parseFloat(q) || 1` read 0 as falsy and quietly invoiced one unit.
      badQuantity: !blank && (quantity == null || quantity <= 0),
      badPrice: !blank && (unitPrice == null || unitPrice < 0),
      subtotal: (quantity ?? 0) * (unitPrice ?? 0),
    };
  }), [lines]);

  const billable = parsedLines.filter(l => !l.blank && !l.badQuantity && !l.badPrice && l.subtotal > 0 && l.raw.description.trim());
  const subtotal = billable.reduce((sum, l) => sum + l.subtotal, 0);
  const discountVal = num(discount) ?? 0;
  const taxRateVal = num(taxRate) ?? 0;
  const discountTooBig = discountVal > subtotal && subtotal > 0;
  const taxable = Math.max(0, subtotal - discountVal);
  const taxVal = taxable * taxRateVal / 100;
  const total = taxable + taxVal;

  /* ── The billable ceiling ───────────────────────────────────────────── */

  const ceiling = useMemo(() => ceilingOf(project), [project]);
  const remaining = ceiling.remainingCents / 100;
  // A change order is exempt at creation: it exists precisely to ask for
  // scope beyond the contract, and the ceiling rises when it is approved.
  const ceilingBlocks = !isCO && ceiling.band === 'none';
  const overCeiling = !isCO && ceiling.band !== 'unknown' && ceiling.band !== 'none' && total > remaining;

  /* ── Option sources ─────────────────────────────────────────────────── */

  const fetchClients = useCallback(async (query: string): Promise<PickerOption[]> => {
    const page = await listClients(query || undefined, undefined, 0, 20);
    return page.content.map(c => ({ id: String(c.id), label: c.name, sub: c.contact ?? c.email ?? null }));
  }, []);

  const projectCache = useRef(new Map<string, ProjectResponse>());
  const fetchProjects = useCallback(async (query: string): Promise<PickerOption[]> => {
    // ACTIVE and INACTIVE are both invoiceable; only CLOSED is refused. The
    // server takes one status at a time, so both are asked for and merged —
    // and there is no "only the complete ones" filter to ask for at all
    // (`incomplete=true` returns the broken ones, which is the opposite), so
    // that half is read off each project's own client and cost code, the two
    // fields ProjectAccountingGuard checks.
    const [active, inactive] = await Promise.all([
      listProjects({ search: query || undefined, status: 'ACTIVE', size: 20 }),
      listProjects({ search: query || undefined, status: 'INACTIVE', size: 10 }),
    ]);
    const all = [...active.content, ...inactive.content];
    all.forEach(p => projectCache.current.set(String(p.id), p));
    return all.map(p => {
      const missing = [
        !p.clientId && t('finance:invoice.picker.missingClient'),
        !p.costCode && t('finance:invoice.picker.missingCostCode'),
      ].filter(Boolean) as string[];
      return {
        id: String(p.id),
        label: p.name,
        sub: [p.costCode, p.client?.name].filter(Boolean).join(' · ') || null,
        blocked: missing.length ? t('finance:invoice.picker.notBillable', { missing: missing.join(', ') }) : null,
      };
    });
  }, [t]);

  /* ── The tenant's letterhead ────────────────────────────────────────── */

  const [issuer, setIssuer] = useState<InvoiceIssuerPdf | undefined>();
  const [issuerReady, setIssuerReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    loadInvoiceIssuer().then(loaded => {
      if (cancelled) return;
      setIssuer(loaded);
      setIssuerReady(true);
    });
    return () => { cancelled = true; };
  }, []);
  const noLetterhead = issuerReady && !issuer?.name && !issuer?.logoDataUrl;

  /* ── Live preview ───────────────────────────────────────────────────── */

  const clientName = client?.id === OTHER ? clientCustom.trim() : client?.label ?? '';

  const previewData = useMemo<InvoicePdfData | null>(() => {
    const items = parsedLines
      .filter(l => l.raw.description.trim() || (l.unitPrice ?? 0) > 0)
      .map(l => ({
        description: l.raw.description.trim(),
        quantity: l.quantity ?? 0,
        unitPrice: l.unitPrice ?? 0,
        subtotal: l.subtotal,
      }));
    if (items.length === 0) return null;
    return {
      documentType: docType,
      // The real number is assigned by the server's per-tenant sequence when
      // the document is saved. Until then the field is either what the user
      // typed or blank — never a placeholder that could travel into a PDF.
      invoiceNumber: number.trim(),
      client: clientName || '—',
      project: project?.name ?? '—',
      description: description.trim() || null,
      issuedDate,
      dueDate,
      lineItems: items,
      subtotal,
      discount: discountVal,
      taxRate: taxRateVal,
      tax: taxVal,
      amount: total,
      notes: notes.trim() || null,
    };
  }, [parsedLines, docType, number, clientName, project, description, issuedDate, dueDate, subtotal, discountVal, taxRateVal, taxVal, total, notes]);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  useEffect(() => {
    if (!previewData) {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
      setPreviewUrl(null);
      return;
    }
    if (!issuerReady) return; // don't flash a headerless draft before it lands
    const handle = setTimeout(() => {
      let url: string | null;
      try {
        url = invoicePdfPreviewUrl(previewData, issuer, undefined, lang);
      } catch {
        url = null; // a half-typed state must not take the editor down
      }
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = url;
      setPreviewUrl(url);
    }, 400);
    return () => clearTimeout(handle);
  }, [previewData, issuer, issuerReady, lang]);
  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  /* ── Submit ─────────────────────────────────────────────────────────── */

  const datesWrong = new Date(dueDate) < new Date(issuedDate);
  const missingClient = !clientName;
  const missingProject = !project;
  const noLines = billable.length === 0;
  const badLines = parsedLines.some(l => l.badQuantity || l.badPrice);
  const canSubmit = !submitting && !missingClient && !missingProject && !noLines && !badLines
    && !discountTooBig && total > 0 && !(isCO && !description.trim())
    && !datesWrong && !ceilingBlocks && !overCeiling;

  const handleSubmit = async () => {
    setTouched(true);
    if (!canSubmit || !project) return;
    setSubmitting(true);
    setFailure(null);
    try {
      const created = await createReceivable({
        documentType: docType,
        invoiceNumber: number.trim() || undefined,
        client: clientName,
        projectId: project.id,
        description: description.trim() || undefined,
        issuedDate,
        dueDate: isCO ? issuedDate : dueDate,
        lineItems: billable.map(l => ({
          description: l.raw.description.trim(),
          quantity: l.quantity as number,
          unitPrice: l.unitPrice as number,
        })),
        discount: discountVal > 0 ? discountVal : undefined,
        taxRate: taxRateVal > 0 ? taxRateVal : undefined,
        notes: notes.trim() || undefined,
      });
      // Only now does the document have a number, so only now can it become a
      // PDF someone could send.
      try {
        downloadInvoicePdf(
          {
            documentType: created.documentType,
            invoiceNumber: created.invoiceNumber,
            client: created.client,
            project: created.project,
            description: created.description,
            issuedDate: created.issuedDate,
            dueDate: created.dueDate,
            lineItems: created.lineItems.map(li => ({
              description: li.description, quantity: li.quantity,
              unitPrice: li.unitPrice, subtotal: li.subtotal,
            })),
            subtotal: created.subtotal,
            discount: created.discount,
            taxRate: created.taxRate,
            tax: created.tax,
            amount: created.amount,
            notes: created.notes,
          },
          await loadInvoiceIssuer(),
          undefined,
          lang,
        );
      } catch {
        // The document is saved; a failed download is not a failed issue.
      }
      onCreated(created);
    } catch (err) {
      setFailure(submitError(err, t));
      setSubmitting(false);
    }
  };

  /* ── Render ─────────────────────────────────────────────────────────── */

  const setLine = (index: number, key: keyof DraftLine, value: string) =>
    setLines(prev => prev.map((l, i) => (i === index ? { ...l, [key]: value } : l)));

  const ceilingTone = {
    room: { edge: 'border-l-[#2E7D4F]', bg: 'bg-[#FBF8F2]' },
    tight: { edge: 'border-l-[#F97316]', bg: 'bg-[#FBEDE0]' },
    none: { edge: 'border-l-[#B3402A]', bg: 'bg-[#FBEDE0]' },
    unknown: { edge: 'border-l-[#DBD0BB]', bg: 'bg-[#FBF8F2]' },
  }[ceiling.band];

  const fieldError = (field: InvoiceSubmitError['field']) =>
    failure?.field === field ? <FieldError>{failure.message}</FieldError> : null;

  return (
    <div className="fixed inset-0 z-[90] bg-[#FAFAFA] flex flex-col" role="dialog" aria-modal="true" aria-labelledby="invoice-window-title">
      <InkBar className="px-4 pt-3.5 pb-4 md:px-7 md:pt-[18px] md:pb-5 flex-shrink-0">
        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0">
            <Mono className="block text-[9px] md:text-[10px] font-semibold tracking-[0.14em] text-[#F97316]">
              {t('finance:invoice.window.kicker')}
            </Mono>
            <h2 id="invoice-window-title" className="font-bt-display font-extrabold uppercase text-[28px] md:text-[38px] leading-none tracking-[0.01em] text-[#F5F1E8] mt-2">
              {t('finance:invoice.window.title')}
            </h2>
            <Mono className="block text-[10px] tracking-[0.1em] text-[#F5F1E8]/55 mt-2">
              {t('finance:invoice.window.numberedOnSave')}
            </Mono>
          </div>
          <CloseButton onDark onClick={onClose} disabled={submitting} aria-label={t('common:buttons.close')} className="w-8 h-8" />
        </div>
      </InkBar>

      {/* Document type */}
      <div className="flex border-b border-[#E7E1D5] bg-[#FBF8F2] flex-shrink-0 flex-wrap" data-tour="sec.invoices-emitir.type">
        {([['INVOICE', 'invoice.type.invoice'], ['CHANGE_ORDER_REQUEST', 'invoice.type.changeOrder']] as const).map(([type, key]) => (
          <button
            key={type}
            type="button"
            onClick={() => setDocType(type)}
            aria-pressed={docType === type}
            className={cn(
              'px-5 py-2.5 font-bt-mono text-[11px] uppercase tracking-[0.1em] border-b-2 transition-colors',
              docType === type ? 'border-b-[#F97316] bg-white text-[#0A0A0A] font-semibold' : 'border-b-transparent text-[#8A8175] hover:text-[#C2410C]',
              FOCUS_RING,
            )}
          >
            {t(`finance:${key}`)}
          </button>
        ))}
        <Mono className="ml-auto self-center pr-4 text-[10px] tracking-[0.08em] text-[#8A8175] hidden md:block">
          {t(isCO ? 'finance:invoice.window.corTagline' : 'finance:invoice.window.invoiceTagline')}
        </Mono>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden lg:grid lg:grid-cols-[minmax(0,1fr)_430px]">
        {/* ── Form ─────────────────────────────────────────────────────── */}
        <div className="lg:min-h-0 lg:overflow-y-auto px-4 py-5 md:px-6 md:py-5 flex flex-col gap-4 border-r border-[#E7E1D5]">
          {isCO && (
            <div className="bg-[#0A0A0A] text-[#F5F1E8] px-4 py-3 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-[#F97316] flex-shrink-0 mt-0.5" strokeWidth={2.2} />
              <p className="text-[12.5px] leading-[1.55]">{t('finance:invoice.window.corNotice')}</p>
            </div>
          )}

          {noLetterhead && (
            <PaperNote tone="orange">
              {t('finance:invoice.window.noLetterhead')}{' '}
              {onOpenBranding && (
                <button type="button" onClick={onOpenBranding} className={cn('font-bt-mono text-[10.5px] font-semibold uppercase tracking-[0.09em] text-[#C2410C] hover:text-[#F97316]', FOCUS_RING)}>
                  {t('finance:invoice.window.configureLetterhead')} →
                </button>
              )}
            </PaperNote>
          )}

          {/* Number + dates */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5" data-tour="sec.invoices-emitir.number">
            <div>
              <FieldLabel htmlFor="inv-number">{t(isCO ? 'finance:invoice.dialog.corNumber' : 'finance:invoice.dialog.invoiceNo')}</FieldLabel>
              <input
                id="inv-number"
                value={number}
                onChange={e => setNumber(e.target.value)}
                maxLength={FIELD_LIMITS.IDENTIFIER}
                placeholder={t(isCO ? 'finance:invoice.window.numberPhCor' : 'finance:invoice.window.numberPh')}
                className={cn(INPUT, INPUT_MONO, failure?.field === 'number' && INPUT_ERROR)}
              />
              <FieldHint className="normal-case tracking-normal text-[11.5px]">{t('finance:invoice.window.numberHint')}</FieldHint>
              {fieldError('number')}
            </div>
            <div>
              <FieldLabel htmlFor="inv-issued">{t('finance:invoice.dialog.issuedDate')}</FieldLabel>
              <input id="inv-issued" type="date" value={issuedDate} onChange={e => setIssuedDate(e.target.value)} className={cn(INPUT, INPUT_MONO)} />
            </div>
            <div>
              <FieldLabel htmlFor="inv-due">{t('finance:invoice.dialog.dueDate')}</FieldLabel>
              <input
                id="inv-due"
                type="date"
                value={isCO ? '' : dueDate}
                disabled={isCO}
                onChange={e => setDueDate(e.target.value)}
                className={cn(INPUT, INPUT_MONO, (datesWrong || failure?.field === 'dates') && INPUT_ERROR)}
              />
              <FieldHint className="normal-case tracking-normal text-[11.5px]">
                {t(isCO ? 'finance:invoice.window.dueCor' : 'finance:invoice.window.dueHint')}
              </FieldHint>
              {datesWrong && <FieldError>{t('finance:invoice.validation.dueDateAfter')}</FieldError>}
              {fieldError('dates')}
            </div>
          </div>

          {/* Client + project */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5" data-tour="sec.invoices-emitir.client-project">
            <div>
              <SearchSelect
                testId="invoice-client"
                label={t('finance:invoice.dialog.client')}
                placeholder={t('finance:invoice.window.clientPh')}
                hint={t('finance:invoice.window.clientHint')}
                emptyText={t('finance:invoice.window.clientEmpty')}
                error={touched && missingClient}
                value={client}
                onChange={option => { setClient(option); if (option?.id !== OTHER) setClientCustom(''); }}
                fetchOptions={fetchClients}
                footer={
                  <TertiaryButton
                    className="text-[10px]"
                    onClick={() => setClient({ id: OTHER, label: t('finance:invoice.dialog.clientOther') })}
                  >
                    {t('finance:invoice.window.clientOther')}
                  </TertiaryButton>
                }
              />
              {client?.id === OTHER && (
                <input
                  className={cn(INPUT, 'mt-2')}
                  placeholder={t('finance:invoice.dialog.clientPlaceholder')}
                  maxLength={FIELD_LIMITS.SHORT_NAME}
                  value={clientCustom}
                  onChange={e => setClientCustom(e.target.value)}
                />
              )}
            </div>
            <div>
              <SearchSelect
                testId="invoice-project"
                label={t('finance:invoice.dialog.project')}
                placeholder={t('finance:invoice.window.projectPh')}
                hint={t('finance:invoice.window.projectHint')}
                emptyText={t('finance:invoice.window.projectEmpty')}
                error={(touched && missingProject) || failure?.field === 'project'}
                value={project ? { id: String(project.id), label: project.name } : null}
                onChange={option => setProject(option ? projectCache.current.get(option.id) ?? null : null)}
                fetchOptions={fetchProjects}
              />
              {fieldError('project')}
            </div>
          </div>

          {/* The billable ceiling */}
          {project && (
            <div className={cn('border border-[#E7E1D5] border-l-[3px] px-4 py-3', ceilingTone.edge, ceilingTone.bg)} data-testid="invoice-ceiling">
              {ceiling.band === 'unknown' ? (
                <>
                  <Mono className="block text-[9.5px] tracking-[0.13em] text-[#8A8175]">{t('finance:invoice.ceiling.unknownLabel')}</Mono>
                  <p className="text-[12.5px] leading-[1.5] text-[#5A5346] mt-1.5">{t('finance:invoice.ceiling.unknownBody')}</p>
                </>
              ) : (
                <>
                  <div className="flex items-end justify-between gap-4 flex-wrap">
                    <div>
                      <Mono className="block text-[9.5px] tracking-[0.13em] text-[#8A8175]">
                        {t(ceiling.band === 'none' ? 'finance:invoice.ceiling.fullLabel' : 'finance:invoice.ceiling.label', { project: project.name })}
                      </Mono>
                      <div className="font-bt-display font-extrabold text-[38px] leading-[0.88] text-[#0A0A0A] mt-1 tabular-nums" data-testid="invoice-ceiling-amount">
                        {fmtCents(Math.max(0, ceiling.remainingCents), { decimals: false })}
                      </div>
                    </div>
                    <Mono className="text-[10.5px] tracking-[0.06em] text-[#5A5346] leading-[1.6] text-right">
                      {t('finance:invoice.ceiling.of', {
                        invoiced: fmtCents(ceiling.invoicedCents, { decimals: false }),
                        ceiling: fmtCents(ceiling.ceilingCents ?? 0, { decimals: false }),
                        pct: Math.round(ceiling.used * 100),
                      })}
                    </Mono>
                  </div>
                  <div className="h-[7px] bg-[#F3EEE4] border border-[#EDE7DB] mt-2.5 flex">
                    <div className="bg-[#0A0A0A]" style={{ width: `${Math.round(ceiling.used * 100)}%` }} />
                  </div>
                  <p className="text-[12px] leading-[1.5] text-[#5A5346] mt-2">
                    {t(isCO
                      ? 'finance:invoice.ceiling.exempt'
                      : ceiling.band === 'none' ? 'finance:invoice.ceiling.noneBody'
                      : ceiling.band === 'tight' ? 'finance:invoice.ceiling.tightBody'
                      : 'finance:invoice.ceiling.roomBody')}
                  </p>
                  {ceilingBlocks && (
                    <div className="mt-2.5">
                      <SecondaryButton onClick={() => setDocType('CHANGE_ORDER_REQUEST')} className="bg-white">
                        {t('finance:invoice.ceiling.switchToCor')}
                      </SecondaryButton>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Description / reason */}
          <div>
            <FieldLabel htmlFor="inv-description" required={isCO}>
              {t(isCO ? 'finance:invoice.window.corReason' : 'finance:invoice.dialog.description')}
            </FieldLabel>
            <input
              id="inv-description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              maxLength={FIELD_LIMITS.NOTE}
              placeholder={t(isCO ? 'finance:invoice.window.corReasonPh' : 'finance:invoice.dialog.descriptionPlaceholder')}
              className={cn(INPUT, touched && isCO && !description.trim() && INPUT_ERROR)}
            />
            {isCO && <FieldHint className="normal-case tracking-normal text-[11.5px]">{t('finance:invoice.window.corReasonHint')}</FieldHint>}
            {touched && isCO && !description.trim() && <FieldError>{t('finance:invoice.validation.corReason')}</FieldError>}
          </div>

          {/* Line items */}
          <div data-tour="sec.invoices-emitir.line-items">
            <div className="flex items-center justify-between gap-3 mb-2">
              <Mono className="text-[9.5px] font-semibold tracking-[0.13em] text-[#5A5346]">{t('finance:invoice.dialog.lineItems')}</Mono>
              <SecondaryButton onClick={() => setLines(prev => [...prev, { ...EMPTY_LINE }])} className="bg-[#FAF7F0] text-[10px] px-2.5 py-1.5">
                <Plus className="w-3 h-3" strokeWidth={2.4} />{t('finance:invoice.dialog.addItem')}
              </SecondaryButton>
            </div>
            <div className="border border-[#E7E1D5]">
              <div className="hidden md:grid grid-cols-[minmax(0,1fr)_100px_74px_96px_28px] gap-2 px-3 py-2 bg-[#FBF8F2] border-b border-[#EDE7DB] font-bt-mono text-[9px] uppercase tracking-[0.12em] text-[#A69C8D]">
                <span>{t('finance:invoice.dialog.itemDesc')}</span>
                <span className="text-right">{t('finance:invoice.dialog.itemPrice')}</span>
                <span className="text-right">{t('finance:invoice.dialog.itemQty')}</span>
                <span className="text-right">{t('finance:invoice.dialog.itemSubtotal')}</span>
                <span />
              </div>
              {parsedLines.map((line, index) => (
                <div key={index} className="border-b border-[#F0EBE1] last:border-b-0 px-3 py-2">
                  <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_100px_74px_96px_28px] gap-2 items-center">
                    <input
                      value={line.raw.description}
                      onChange={e => setLine(index, 'description', e.target.value)}
                      maxLength={FIELD_LIMITS.LINE_ITEM}
                      placeholder={t('finance:invoice.dialog.itemDescPlaceholder')}
                      className={cn(INPUT, 'h-9 text-[12.5px]')}
                    />
                    <input
                      inputMode="decimal"
                      value={line.raw.unitPrice}
                      onChange={e => setLine(index, 'unitPrice', e.target.value)}
                      placeholder="0.00"
                      aria-label={t('finance:invoice.dialog.itemPrice')}
                      className={cn(INPUT, INPUT_MONO, 'h-9 text-right text-[12px]', line.badPrice && INPUT_ERROR)}
                    />
                    <input
                      inputMode="decimal"
                      value={line.raw.quantity}
                      onChange={e => setLine(index, 'quantity', e.target.value)}
                      aria-label={t('finance:invoice.dialog.itemQty')}
                      className={cn(INPUT, INPUT_MONO, 'h-9 text-right text-[12px]', line.badQuantity && INPUT_ERROR)}
                    />
                    <span className="font-bt-mono text-[12.5px] text-right text-[#0A0A0A] tabular-nums">{fmtMoney(line.subtotal, { decimals: false })}</span>
                    {lines.length > 1 ? (
                      <button
                        type="button"
                        aria-label={t('finance:invoice.window.removeLine')}
                        onClick={() => setLines(prev => prev.filter((_, i) => i !== index))}
                        className={cn('w-[26px] h-[26px] border border-[#DBD0BB] bg-white text-[#B3402A] hover:border-[#B3402A] flex items-center justify-center justify-self-end', FOCUS_RING)}
                      >
                        <Minus className="w-3 h-3" strokeWidth={2.4} />
                      </button>
                    ) : <span />}
                  </div>
                  {(line.badQuantity || line.badPrice) && (
                    <FieldError>{line.badQuantity ? t('finance:invoice.validation.quantity') : t('finance:invoice.validation.price')}</FieldError>
                  )}
                </div>
              ))}
            </div>
            <FieldHint className="normal-case tracking-normal text-[11.5px]">{t('finance:invoice.window.linesHint')}</FieldHint>
          </div>

          {/* Notes + totals */}
          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_300px] gap-4 items-start" data-tour="sec.invoices-emitir.totals">
            <div>
              <FieldLabel htmlFor="inv-notes">{t('finance:invoice.dialog.notes')}</FieldLabel>
              <textarea
                id="inv-notes"
                rows={3}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                maxLength={FIELD_LIMITS.EXTENDED_NOTE}
                placeholder={t('finance:invoice.dialog.notesPlaceholder')}
                className={cn(INPUT, 'h-auto py-2 resize-none')}
              />
            </div>
            <div className="border border-[#E7E1D5]">
              <div className="flex items-center justify-between gap-3 px-3 py-1.5 border-b border-[#F0EBE1]">
                <Mono className="text-[10px] tracking-[0.1em] text-[#8A8175]">{t('finance:invoice.dialog.subtotal')}</Mono>
                <span className="font-bt-mono text-[12.5px] tabular-nums">{fmtMoney(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 px-3 py-1.5 border-b border-[#F0EBE1]">
                <Mono className="text-[10px] tracking-[0.1em] text-[#8A8175]">{t('finance:invoice.dialog.discount')}</Mono>
                <input
                  inputMode="decimal"
                  value={discount}
                  onChange={e => setDiscount(e.target.value)}
                  placeholder="0.00"
                  aria-label={t('finance:invoice.dialog.discount')}
                  className={cn(INPUT, INPUT_MONO, 'h-8 w-[110px] text-right text-[12px]', (discountTooBig || failure?.field === 'discount') && INPUT_ERROR)}
                />
              </div>
              <div className="flex items-center justify-between gap-3 px-3 py-1.5 border-b border-[#F0EBE1]">
                <Mono className="text-[10px] tracking-[0.1em] text-[#8A8175]">{t('finance:invoice.dialog.taxRate')} %</Mono>
                <input
                  inputMode="decimal"
                  value={taxRate}
                  onChange={e => setTaxRate(e.target.value)}
                  placeholder="0"
                  aria-label={t('finance:invoice.dialog.taxRate')}
                  className={cn(INPUT, INPUT_MONO, 'h-8 w-[90px] text-right text-[12px]')}
                />
              </div>
              <div className="flex items-baseline justify-between gap-3 px-3 py-2.5 bg-[#F3EEE4]">
                <Mono className="text-[10px] font-semibold tracking-[0.11em] text-[#0A0A0A]">{t('finance:invoice.dialog.total')}</Mono>
                <span className="font-bt-display font-extrabold text-[26px] leading-none tabular-nums" data-testid="invoice-total">{fmtMoney(total)}</span>
              </div>
              {discountTooBig && (
                <div className="px-3 py-2 border-t border-[#F0EBE1]">
                  <FieldError>{t('finance:invoice.validation.discountTooBig', { max: fmtMoney(subtotal) })}</FieldError>
                </div>
              )}
              {overCeiling && (
                <div className="px-3 py-2 border-t border-[#F0EBE1]" data-testid="invoice-over-ceiling">
                  <FieldError>{t('finance:invoice.validation.overCeiling', {
                    over: fmtMoney(total - remaining),
                    remaining: fmtCents(ceiling.remainingCents),
                  })}</FieldError>
                </div>
              )}
              {failure?.field === 'total' && (
                <div className="px-3 py-2 border-t border-[#F0EBE1]"><FieldError>{failure.message}</FieldError></div>
              )}
            </div>
          </div>
        </div>

        {/* ── The document, drawing itself ─────────────────────────────── */}
        <div className="lg:min-h-0 lg:overflow-hidden bg-[#F3EEE4] p-4 flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-3">
            <Mono className="text-[9.5px] tracking-[0.13em] text-[#5A5346]">{t('finance:invoice.preview.live')}</Mono>
          </div>
          <div className="flex-1 min-h-[420px] border border-[#CDBFA6] bg-white overflow-hidden">
            {previewUrl ? (
              <iframe
                key="invoice-preview"
                src={`${previewUrl}#toolbar=0&navpanes=0&view=FitH`}
                title={t('finance:invoice.preview.title')}
                className="w-full h-full min-h-[420px] bg-[#525659]"
              />
            ) : (
              <div className="h-full min-h-[420px] flex flex-col items-center justify-center text-center px-6 gap-3">
                <FileText className="w-9 h-9 text-[#CDBFA6]" />
                <p className="text-[13px] text-[#8A8175] max-w-[240px]">{t('finance:invoice.preview.empty')}</p>
              </div>
            )}
          </div>
          <p className="text-[11.5px] leading-[1.5] text-[#5A5346]">{t('finance:invoice.preview.note')}</p>
        </div>
      </div>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <div className="border-t border-[#E7E1D5] bg-[#FBF8F2] px-4 md:px-6 py-3 flex-shrink-0">
        {failure && !failure.field && (
          <div className="mb-2.5">
            <PaperNote tone="red">
              {failure.message}
              {failure.detail && (
                <>
                  {' '}
                  <button type="button" onClick={() => setShowDetail(v => !v)} className={cn('font-bt-mono text-[9.5px] uppercase tracking-[0.1em] text-[#8A8175] hover:text-[#C2410C]', FOCUS_RING)}>
                    {t('finance:invoice.error.forSupport')}
                  </button>
                  {showDetail && <Mono className="block text-[9.5px] tracking-[0.08em] text-[#8A8175] mt-1.5">{failure.detail}</Mono>}
                </>
              )}
            </PaperNote>
          </div>
        )}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <Mono className="text-[10px] tracking-[0.08em] text-[#8A8175] hidden md:block">{t('finance:invoice.window.footerHint')}</Mono>
          <div className="flex items-center gap-3 ml-auto">
            <TertiaryButton onClick={onClose} disabled={submitting} className="text-[10.5px]">{t('common:buttons.cancel')}</TertiaryButton>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={!canSubmit}
              data-testid="invoice-submit"
              className={cn(
                'inline-flex items-center justify-center gap-2 font-bt-mono text-[11.5px] font-semibold uppercase tracking-[0.09em] px-5 py-3 transition-colors',
                'bg-[#F97316] text-[#0A0A0A] hover:bg-[#C2410C] hover:text-[#F5F1E8]',
                'disabled:bg-[#EAE4D8] disabled:text-[#A69C8D] disabled:cursor-not-allowed',
                FOCUS_RING,
              )}
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {t(isCO ? 'finance:invoice.window.submitCor' : 'finance:invoice.window.submitInvoice', { total: fmtMoney(total, { decimals: false }) })}
              {!submitting && <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.4} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
