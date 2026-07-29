import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, CheckCircle2, Clock, Info, AlertCircle, RefreshCw, FileText, Download } from 'lucide-react';
import { Button } from './ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from './ui/select';
import { toast } from 'sonner';
import {
  createReceivable, type DocumentType,
} from '../services/finance';
import { listProjects } from '../services/projects';
import { listClients, type ClientResponse } from '../services/clients';
import { businessToday } from '../helpers/dateTime';
import {
  invoicePdfPreviewUrl, downloadInvoicePdf, type InvoicePdfData, type InvoiceIssuerPdf,
} from '../helpers/exportInvoicePdf';
import { loadInvoiceIssuer } from '../services/invoiceBranding';
import { FIELD_LIMITS } from '../../shared/fieldLimits';

// ── Types ───────────────────────────────────────────

interface DraftLineItem {
  description: string;
  quantity: string;
  unitPrice: string;
}

// ── Helpers ─────────────────────────────────────────

function fmtAmount(n: number) {
  return `$${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}
function todayISO() { return businessToday(); }

// ── Main Component ──────────────────────────────────

export function InvoiceManager() {
  const { t } = useTranslation('finance');

  // Reference data
  const [projects, setProjects] = useState<{ id: number; name: string }[]>([]);
  const [clients, setClients] = useState<ClientResponse[]>([]);
  const [refError, setRefError] = useState(false);

  const loadRefData = useCallback(() => {
    setRefError(false);
    Promise.all([
      listProjects({ page: 0, size: 200 })
        .then(r => setProjects(r.content.map((p: any) => ({ id: p.id, name: p.name })))),
      listClients()
        .then(r => setClients(r.content)),
    ]).catch(() => setRefError(true));
  }, []);

  useEffect(() => { loadRefData(); }, [loadRefData]);

  // Form state
  const [docType, setDocType] = useState<DocumentType>('INVOICE');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientCustom, setClientCustom] = useState('');
  const [projectId, setProjectId] = useState('');
  const [description, setDescription] = useState('');
  const [issuedDate, setIssuedDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState(todayISO());
  const [notes, setNotes] = useState('');
  const [discount, setDiscount] = useState('');
  const [taxRate, setTaxRate] = useState('');
  const [lineItems, setLineItems] = useState<DraftLineItem[]>([
    { description: '', quantity: '1', unitPrice: '' },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [justCreated, setJustCreated] = useState(false);
  // Remember what was just created — `docType` itself is cleared by
  // resetForm() before we show the success banner, so we need to
  // capture it independently to render the correct copy/colours.
  const [lastCreatedDocType, setLastCreatedDocType] = useState<DocumentType | null>(null);

  const addLineItem = () => setLineItems(prev => [...prev, { description: '', quantity: '1', unitPrice: '' }]);
  const removeLineItem = (idx: number) => setLineItems(prev => prev.filter((_, i) => i !== idx));
  const updateLineItem = (idx: number, field: keyof DraftLineItem, value: string) => {
    setLineItems(prev => prev.map((li, i) => i === idx ? { ...li, [field]: value } : li));
  };

  const subtotal = useMemo(() =>
    lineItems.reduce((s, li) => {
      const q = parseFloat(li.quantity) || 0;
      const p = parseFloat(li.unitPrice) || 0;
      return s + q * p;
    }, 0),
    [lineItems],
  );

  const discountVal = parseFloat(discount) || 0;
  const taxRateVal = parseFloat(taxRate) || 0;
  const taxable = Math.max(0, subtotal - discountVal);
  const taxVal = taxable * taxRateVal / 100;
  const totalAmount = taxable + taxVal;

  // ── Live PDF preview ──────────────────────────────────────────────
  // Assemble the same InvoicePdfData the download uses, from the current
  // form state, so the preview is byte-identical to what gets sent to the
  // client. Line items with neither a description nor a price are dropped
  // so half-typed rows don't clutter the preview.
  const previewData = useMemo<InvoicePdfData | null>(() => {
    const items = lineItems
      .map(li => {
        const quantity = parseFloat(li.quantity) || 0;
        const unitPrice = parseFloat(li.unitPrice) || 0;
        return {
          description: li.description.trim(),
          quantity,
          unitPrice,
          subtotal: quantity * unitPrice,
        };
      })
      .filter(li => li.description || li.unitPrice > 0);
    if (items.length === 0) return null; // nothing meaningful to render yet
    const finalClient = clientName === '__other__' ? clientCustom.trim() : clientName;
    const projectName = projects.find(p => String(p.id) === projectId)?.name ?? '';
    return {
      documentType: docType as InvoicePdfData['documentType'],
      invoiceNumber: invoiceNumber.trim() || t('invoice.dialog.autoGenerate'),
      client: finalClient || '—',
      project: projectName || '—',
      description: description.trim() || null,
      issuedDate,
      dueDate,
      lineItems: items,
      subtotal,
      discount: discountVal,
      taxRate: taxRateVal,
      tax: taxVal,
      amount: totalAmount,
      notes: notes.trim() || null,
    };
  }, [
    lineItems, clientName, clientCustom, projects, projectId, docType,
    invoiceNumber, description, issuedDate, dueDate, subtotal, discountVal,
    taxRateVal, taxVal, totalAmount, notes, t,
  ]);

  // The tenant's invoice template (issuer block + logo) — loaded once
  // (session-cached in the service); the preview regenerates when it lands.
  const [issuer, setIssuer] = useState<InvoiceIssuerPdf | undefined>(undefined);
  const [issuerReady, setIssuerReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    loadInvoiceIssuer().then((loaded) => {
      if (cancelled) return;
      setIssuer(loaded);
      setIssuerReady(true);
    });
    return () => { cancelled = true; };
  }, []);

  // Regenerate the blob URL (debounced) whenever the data changes, and
  // always revoke the previous URL so blobs don't leak.
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  useEffect(() => {
    if (!previewData) {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
      setPreviewUrl(null);
      return;
    }
    if (!issuerReady) return; // avoid a legacy-header flash before the template loads
    const handle = setTimeout(() => {
      let url: string | null = null;
      try {
        url = invoicePdfPreviewUrl(previewData, issuer);
      } catch {
        url = null; // a transient bad state shouldn't crash the editor
      }
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = url;
      setPreviewUrl(url);
    }, 400);
    return () => clearTimeout(handle);
  }, [previewData, issuer, issuerReady]);

  // Final cleanup on unmount.
  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  const resetForm = () => {
    setDocType('INVOICE');
    setInvoiceNumber('');
    setClientName('');
    setClientCustom('');
    setProjectId('');
    setDescription('');
    setIssuedDate(todayISO());
    setDueDate(todayISO());
    setNotes('');
    setDiscount('');
    setTaxRate('');
    setLineItems([{ description: '', quantity: '1', unitPrice: '' }]);
  };

  const handleCreate = async () => {
    const finalClient = clientName === '__other__' ? clientCustom.trim() : clientName;
    if (!finalClient || !projectId) {
      toast.error(t('invoice.validation.requiredFields'));
      return;
    }
    if (new Date(dueDate) < new Date(issuedDate)) {
      toast.error(t('invoice.validation.dueDateAfter'));
      return;
    }
    const validItems = lineItems.filter(li => li.description.trim() && parseFloat(li.unitPrice) > 0);
    if (validItems.length === 0) {
      toast.error(t('invoice.validation.addItem'));
      return;
    }

    setSubmitting(true);
    try {
      await createReceivable({
        documentType: docType,
        invoiceNumber: invoiceNumber.trim() || undefined,
        client: finalClient,
        projectId: Number(projectId),
        description: description.trim() || undefined,
        issuedDate,
        dueDate,
        lineItems: validItems.map(li => ({
          description: li.description.trim(),
          quantity: parseFloat(li.quantity) || 1,
          unitPrice: parseFloat(li.unitPrice),
        })),
        discount: discountVal > 0 ? discountVal : undefined,
        taxRate: taxRateVal > 0 ? taxRateVal : undefined,
        notes: notes.trim() || undefined,
      });
      toast.success(
        docType === 'CHANGE_ORDER_REQUEST'
          ? t('invoice.toast.corCreated')
          : t('invoice.toast.invoiceCreated'),
      );
      // Snapshot the docType BEFORE resetForm() wipes it, so the
      // success screen can branch its copy + theme correctly.
      setLastCreatedDocType(docType);
      resetForm();
      setJustCreated(true);
    } catch (e: any) {
      toast.error(e?.message ?? 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  const isCOR = docType === 'CHANGE_ORDER_REQUEST';

  // Success banner after creation. The CO branch makes the workflow
  // explicit: amber theme + Clock icon + a hint explaining that the
  // request is pending approval and where to approve it.
  if (justCreated) {
    const justCreatedCOR = lastCreatedDocType === 'CHANGE_ORDER_REQUEST';
    return (
      <div className="max-w-4xl space-y-6">
        <div className="bg-white rounded-xl border border-[#D4D4D8] p-10 text-center space-y-4">
          {justCreatedCOR ? (
            <Clock className="w-14 h-14 text-amber-500 mx-auto" />
          ) : (
            <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto" />
          )}
          <h2 className="text-xl font-bold text-[#0A0A0A]">
            {justCreatedCOR
              ? t('invoice.toast.corCreatedTitle')
              : t('invoice.toast.invoiceCreated')}
          </h2>
          <p className="text-sm text-[#71717A]">
            {justCreatedCOR
              ? t('invoice.create.corSuccessHint')
              : t('invoice.create.successHint')}
          </p>
          {justCreatedCOR && (
            <div>
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 inline-block">
                {t('invoice.create.corNextStep')}
              </p>
            </div>
          )}
          <Button
            onClick={() => setJustCreated(false)}
            className={`gap-2 mt-2 ${
              justCreatedCOR
                ? 'bg-amber-600 hover:bg-amber-700'
                : 'bg-purple-600 hover:bg-purple-700'
            }`}
          >
            <Plus className="w-4 h-4" />
            {t('invoice.create.another')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-[#0A0A0A]">
          {isCOR ? t('invoice.dialog.createCOR') : t('invoice.dialog.createInvoice')}
        </h2>
        <p className="text-xs text-[#71717A]">{t('invoice.create.subtitle')}</p>
      </div>

      {/* Form (left) + live PDF preview (right, sticky on large screens) */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(340px,420px)] gap-6 items-start">
      {/* Main form card */}
      <div className="bg-white rounded-xl border border-[#D4D4D8] overflow-hidden">

        {/* Document type toggle */}
        <div className="px-6 py-4 border-b border-[#D4D4D8] bg-[#FAFAFA]/50">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-[#0A0A0A]">{t('invoice.dialog.docType')}</label>
            <div className="flex rounded-lg border border-[#D4D4D8] overflow-hidden">
              <button
                type="button"
                className={`px-5 py-2 text-sm font-medium transition-colors ${
                  !isCOR
                    ? 'bg-purple-600 text-white'
                    : 'bg-white text-[#71717A] hover:bg-[#FAFAFA]'
                }`}
                onClick={() => setDocType('INVOICE')}
              >
                {t('invoice.type.invoice')}
              </button>
              <button
                type="button"
                className={`px-5 py-2 text-sm font-medium transition-colors ${
                  isCOR
                    ? 'bg-orange-600 text-white'
                    : 'bg-white text-[#71717A] hover:bg-[#FAFAFA]'
                }`}
                onClick={() => setDocType('CHANGE_ORDER_REQUEST')}
              >
                {t('invoice.type.changeOrder')}
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">

          {/* Pending-approval notice — only when CO mode is active. Makes the
              new approval workflow visible BEFORE the user submits, so the
              document state isn't a surprise after creation. */}
          {isCOR && (
            <div className="flex items-start gap-2 bg-amber-50 border-l-4 border-amber-400 px-4 py-3 rounded-r">
              <Info className="w-4 h-4 text-amber-700 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-900 leading-relaxed">
                {t('invoice.dialog.corPendingNote')}
              </p>
            </div>
          )}

          {/* Row: Number + Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#71717A] mb-1.5">
                {isCOR ? t('invoice.dialog.corNumber') : t('invoice.dialog.invoiceNo')}
              </label>
              <input
                className="w-full h-10 rounded-lg border border-[#D4D4D8] px-3 text-sm bg-white placeholder:text-[#71717A]/50 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 transition-all"
                placeholder={t('invoice.dialog.autoGenerate')}
                maxLength={FIELD_LIMITS.IDENTIFIER}
                value={invoiceNumber}
                onChange={e => setInvoiceNumber(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#71717A] mb-1.5">{t('invoice.dialog.issuedDate')}</label>
              <input type="date" className="w-full h-10 rounded-lg border border-[#D4D4D8] px-3 text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 transition-all" value={issuedDate} onChange={e => setIssuedDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#71717A] mb-1.5">{t('invoice.dialog.dueDate')}</label>
              <input type="date" className="w-full h-10 rounded-lg border border-[#D4D4D8] px-3 text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 transition-all" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
          </div>

          {/* Reference-data load failure — explains why the dropdowns below are empty */}
          {refError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                <p className="text-xs text-red-700">{t('invoice.refDataError', "We couldn't load clients and projects. The dropdowns below may be empty.")}</p>
              </div>
              <button type="button" onClick={loadRefData} className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 hover:text-red-900 transition-colors shrink-0">
                <RefreshCw className="w-3.5 h-3.5" />{t('common:buttons.retry')}
              </button>
            </div>
          )}

          {/* Row: Client + Project */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#71717A] mb-1.5">{t('invoice.dialog.client')} *</label>
              <Select value={clientName} onValueChange={setClientName}>
                <SelectTrigger className="h-10 text-sm">
                  <SelectValue placeholder={t('invoice.dialog.selectClient')} />
                </SelectTrigger>
                <SelectContent>
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                  ))}
                  <SelectItem value="__other__">{t('invoice.dialog.clientOther')}</SelectItem>
                </SelectContent>
              </Select>
              {clientName === '__other__' && (
                <input
                  className="w-full h-10 rounded-lg border border-[#D4D4D8] px-3 text-sm mt-2 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 transition-all"
                  placeholder={t('invoice.dialog.clientPlaceholder')}
                  maxLength={FIELD_LIMITS.SHORT_NAME}
                  value={clientCustom}
                  onChange={e => setClientCustom(e.target.value)}
                />
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-[#71717A] mb-1.5">{t('invoice.dialog.project')} *</label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger className="h-10 text-sm">
                  <SelectValue placeholder={t('invoice.dialog.projectPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {projects.map(p => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-[#71717A] mb-1.5">{t('invoice.dialog.description')}</label>
            <input
              className="w-full h-10 rounded-lg border border-[#D4D4D8] px-3 text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 transition-all"
              placeholder={t('invoice.dialog.descriptionPlaceholder')}
              maxLength={FIELD_LIMITS.NOTE}
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-semibold text-[#0A0A0A] uppercase tracking-wider">{t('invoice.dialog.lineItems')}</label>
              <Button variant="ghost" size="sm" className="text-xs h-7 gap-1 text-purple-600" onClick={addLineItem}>
                <Plus className="w-3 h-3" /> {t('invoice.dialog.addItem')}
              </Button>
            </div>
            <div className="border border-[#D4D4D8] rounded-lg overflow-hidden">
              {/* Table header */}
              <div className="grid grid-cols-[1fr_80px_110px_100px_36px] gap-0 bg-[#FAFAFA] px-4 py-2.5">
                <span className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wider">{t('invoice.dialog.itemDesc')}</span>
                <span className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wider">{t('invoice.dialog.itemQty')}</span>
                <span className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wider">{t('invoice.dialog.itemPrice')}</span>
                <span className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wider">{t('invoice.dialog.itemSubtotal')}</span>
                <span />
              </div>
              {/* Rows */}
              {lineItems.map((li, idx) => {
                const q = parseFloat(li.quantity) || 0;
                const p = parseFloat(li.unitPrice) || 0;
                return (
                  <div key={idx} className="grid grid-cols-[1fr_80px_110px_100px_36px] gap-0 items-center px-4 py-2 border-t border-[#D4D4D8]/50">
                    <input
                      className="h-9 rounded-md border border-[#D4D4D8] px-3 text-sm mr-2"
                      placeholder={t('invoice.dialog.itemDescPlaceholder')}
                      maxLength={FIELD_LIMITS.LINE_ITEM}
                      value={li.description}
                      onChange={e => updateLineItem(idx, 'description', e.target.value)}
                    />
                    <input
                      type="number"
                      min="1"
                      className="h-9 rounded-md border border-[#D4D4D8] px-2 text-sm text-center mr-2"
                      value={li.quantity}
                      onChange={e => updateLineItem(idx, 'quantity', e.target.value)}
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="h-9 rounded-md border border-[#D4D4D8] px-2 text-sm mr-2"
                      placeholder="$0.00"
                      value={li.unitPrice}
                      onChange={e => updateLineItem(idx, 'unitPrice', e.target.value)}
                    />
                    <span className="text-sm font-mono text-[#0A0A0A] px-1">{fmtAmount(q * p)}</span>
                    {lineItems.length > 1 ? (
                      <button onClick={() => removeLineItem(idx)} className="text-[#71717A] hover:text-red-500 transition-colors mx-auto">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    ) : <span />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Totals card */}
          <div className="bg-[#FAFAFA] rounded-xl p-5 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-[#71717A]">{t('invoice.dialog.subtotal')}</span>
              <span className="font-mono font-medium text-[#0A0A0A]">{fmtAmount(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-[#71717A]">{t('invoice.dialog.discount')}</span>
              <input
                type="number"
                min="0"
                step="0.01"
                className="w-32 h-9 rounded-lg border border-[#D4D4D8] px-3 text-sm text-right bg-white"
                placeholder="$0.00"
                value={discount}
                onChange={e => setDiscount(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-[#71717A]">{t('invoice.dialog.taxRate')}</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  className="w-24 h-9 rounded-lg border border-[#D4D4D8] px-3 text-sm text-right bg-white"
                  placeholder="0"
                  value={taxRate}
                  onChange={e => setTaxRate(e.target.value)}
                />
                <span className="text-sm text-[#71717A]">%</span>
              </div>
            </div>
            {taxVal > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-[#71717A]">{t('invoice.dialog.tax')}</span>
                <span className="font-mono text-[#0A0A0A]">{fmtAmount(taxVal)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold border-t border-[#D4D4D8] pt-3 mt-3">
              <span>{t('invoice.dialog.total')}</span>
              <span className="font-mono">{fmtAmount(totalAmount)}</span>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-[#71717A] mb-1.5">{t('invoice.dialog.notes')}</label>
            <textarea
              className="w-full h-24 rounded-lg border border-[#D4D4D8] px-3 py-2.5 text-sm resize-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 transition-all"
              placeholder={t('invoice.dialog.notesPlaceholder')}
              maxLength={FIELD_LIMITS.EXTENDED_NOTE}
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#D4D4D8] bg-[#FAFAFA]/50 flex items-center justify-end gap-3">
          <Button variant="outline" onClick={resetForm}>{t('common:buttons.cancel')}</Button>
          <Button
            disabled={submitting}
            onClick={handleCreate}
            className={`min-w-[160px] ${isCOR ? 'bg-orange-600 hover:bg-orange-700' : 'bg-purple-600 hover:bg-purple-700'}`}
          >
            {submitting ? '...' : (isCOR ? t('invoice.dialog.submitCOR') : t('invoice.dialog.submitInvoice'))}
          </Button>
        </div>
      </div>

      {/* Live PDF preview panel */}
      <div className="lg:sticky lg:top-6">
        <div className="bg-white rounded-xl border border-[#D4D4D8] overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-[#D4D4D8] bg-[#FAFAFA]/50">
            <FileText className="w-4 h-4 text-[#71717A]" />
            <span className="text-sm font-semibold text-[#0A0A0A]">{t('invoice.preview.title')}</span>
            {previewData && (
              <button
                type="button"
                onClick={async () => {
                  if (previewData) downloadInvoicePdf(previewData, await loadInvoiceIssuer());
                }}
                className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-purple-600 hover:text-purple-800 transition-colors"
                title={t('invoice.preview.download')}
              >
                <Download className="w-3.5 h-3.5" />
                {t('invoice.preview.download')}
              </button>
            )}
          </div>
          {previewUrl ? (
            <iframe
              key="invoice-preview"
              src={`${previewUrl}#toolbar=0&navpanes=0&view=FitH`}
              title={t('invoice.preview.title')}
              className="w-full h-[600px] bg-[#525659]"
            />
          ) : (
            <div className="h-[600px] flex flex-col items-center justify-center text-center px-6 gap-3">
              <FileText className="w-10 h-10 text-[#D4D4D8]" />
              <p className="text-sm text-[#71717A] max-w-[220px]">{t('invoice.preview.empty')}</p>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
