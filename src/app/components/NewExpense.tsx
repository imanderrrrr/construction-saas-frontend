import React, { useState, useRef, useEffect } from 'react';
import {
  Receipt, Camera, Send, X, FileText, Loader2, AlertCircle,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from './ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from './ui/select';
import { Textarea } from './ui/textarea';
import { isProjectClosed } from '../helpers/project-utils';
import type { EntityStatus } from '../types';
import { getMyProjects } from '../services/time';
import { createExpense } from '../services/expenses';
import { businessToday } from '../helpers/dateTime';

// Constants

export const EXPENSE_TYPE_KEYS = [
  'fuel', 'materials', 'tools', 'per-diem', 'minor-purchases', 'transportation', 'other',
] as const;

/** @deprecated Use EXPENSE_TYPE_KEYS with i18n `expenses:types.<key>` instead */
export const EXPENSE_TYPES = EXPENSE_TYPE_KEYS.map(value => ({
  value,
  label: value === 'fuel' ? 'Fuel' : value === 'materials' ? 'Materials' : value === 'tools' ? 'Tools'
    : value === 'per-diem' ? 'Per diem' : value === 'minor-purchases' ? 'Minor purchases'
    : value === 'transportation' ? 'Transportation' : 'Other',
}));

// Projects loaded from API — see useEffect in component

// Helpers

function getTodayISO(): string {
  return businessToday();
}

function isFutureDate(dateStr: string): boolean {
  if (!dateStr) return false;
  return dateStr > businessToday();
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Shared input style

const inputCls =
  'h-10 w-full rounded-lg border border-[#D4D4D8] bg-white px-3 text-sm text-[#0A0A0A] ' +
  'focus:outline-none focus:ring-2 focus:ring-[#F97316]/25 focus:border-[#F97316] transition-colors ' +
  'placeholder:text-[#71717A]';

// Field wrapper

function Field({
  label, required, error, touched, children,
}: {
  label: string; required?: boolean; error?: string; touched?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-[#0A0A0A]">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {touched && error && (
        <p className="flex items-center gap-1 text-xs text-red-600 mt-0.5">
          <AlertCircle className="w-3 h-3 flex-shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

// Component

interface NewExpenseProps {
  onSubmitSuccess?: () => void;
}

export function NewExpense({ onSubmitSuccess }: NewExpenseProps) {
  const { t } = useTranslation('expenses');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Projects from API
  const [projects, setProjects] = useState<{ id: number; name: string; status: EntityStatus }[]>([]);
  const [projectsError, setProjectsError] = useState(false);
  useEffect(() => {
    getMyProjects()
      .then(list => {
        setProjects(list.map(p => ({ id: p.id, name: p.name, status: p.status })));
        setProjectsError(false);
      })
      .catch(() => setProjectsError(true));
  }, []);

  // Form values
  const [expenseType,  setExpenseType]  = useState('');
  const [amount,       setAmount]       = useState('');
  const [project,      setProject]      = useState('');
  const [date,         setDate]         = useState(getTodayISO);
  const [receiptFile,  setReceiptFile]  = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [comment,      setComment]      = useState('');

  // UI state
  const [touched,      setTouched]      = useState<Record<string, boolean>>({});
  const [isDragOver,   setIsDragOver]   = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Closed project check
  const selectedProjectObj = projects.find(p => String(p.id) === project);
  const selectedClosed = selectedProjectObj ? isProjectClosed(selectedProjectObj) : false;

  // Derived errors
  const errors: Record<string, string> = {
    expenseType: !expenseType ? t('new.type.required') : '',
    amount:      !amount || Number(amount) <= 0 ? t('new.amount.required') : '',
    project:     !project   ? t('new.project.required')
                            : selectedClosed ? t('new.project.closed') : '',
    date:        !date      ? t('new.date.required')
                            : isFutureDate(date) ? t('new.date.future') : '',
    receiptFile: !receiptFile ? t('new.receipt.required') : '',
  };
  const isValid = Object.values(errors).every(e => !e);

  function touch(field: string) {
    setTouched(prev => ({ ...prev, [field]: true }));
  }

  // File handling
  const MAX_RECEIPT_BYTES = 10 * 1024 * 1024; // 10 MB
  const ALLOWED_TYPES = [
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'image/bmp', 'image/tiff', 'image/heic', 'image/heif',
    'application/pdf',
  ];

  function handleFileSelect(file: File) {
    if (!file.type || (!file.type.startsWith('image/') && file.type !== 'application/pdf')) {
      alert(t('new.receipt.invalidType'));
      return;
    }
    if (file.size > MAX_RECEIPT_BYTES) {
      alert(t('new.receipt.tooLarge'));
      return;
    }
    // Revoke the previous blob URL to prevent memory leaks
    if (receiptPreview) URL.revokeObjectURL(receiptPreview);

    setReceiptFile(file);
    if (file.type.startsWith('image/')) {
      setReceiptPreview(URL.createObjectURL(file));
    } else {
      setReceiptPreview(null);
    }
    touch('receiptFile');
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  }

  function handleRemoveFile() {
    if (receiptPreview) URL.revokeObjectURL(receiptPreview);
    setReceiptFile(null);
    setReceiptPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }

  // Submit / Reset
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched({ expenseType: true, amount: true, project: true, date: true, receiptFile: true });
    if (!isValid) return;

    setIsSubmitting(true);
    try {
      const proj = projects.find(p => String(p.id) === project);
      await createExpense(
        {
          projectId: proj!.id,
          expenseType: expenseType.toUpperCase().replace(/-/g, '_'),
          amountCents: Math.round(Number(amount) * 100),
          expenseDate: date,
          description: comment || undefined,
        },
        receiptFile ?? undefined,
      );
      const typeLabel = t(`types.${expenseType}`, { ns: 'expenses', defaultValue: expenseType });
      toast.success(t('new.toast.success'), {
        description: `$${Number(amount).toFixed(2)} · ${typeLabel} · ${proj?.name}`,
      });
      handleReset();
      onSubmitSuccess?.();
    } catch (err: any) {
      toast.error(t('new.toast.error'), { description: err?.message });
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleReset() {
    setExpenseType('');
    setAmount('');
    setProject('');
    setDate(getTodayISO());
    handleRemoveFile();
    setComment('');
    setTouched({});
  }

  // Render
  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-xl border border-[#D4D4D8] overflow-hidden">

        {/* Card header */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-[#D4D4D8] bg-[#FAFAFA]/50">
          <div className="w-9 h-9 bg-[#F97316]/10 rounded-lg flex items-center justify-center flex-shrink-0">
            <Receipt className="w-4.5 h-4.5 text-[#F97316]" style={{ width: 18, height: 18 }} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#0A0A0A]">{t('new.title')}</h3>
            <p className="text-[11px] text-[#71717A]">{t('new.requiredFields')}</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate className="p-6 space-y-6">

          {/* 1. Expense Type */}
          <Field label={t('new.type.label')} required error={errors.expenseType} touched={touched.expenseType}>
            <Select
              value={expenseType}
              onValueChange={v => { setExpenseType(v); touch('expenseType'); }}
            >
              <SelectTrigger className="h-10 border-[#D4D4D8] text-sm">
                <SelectValue placeholder={t('new.type.placeholder')} />
              </SelectTrigger>
              <SelectContent>
                {EXPENSE_TYPE_KEYS.map(key => (
                  <SelectItem key={key} value={key}>{t(`types.${key}`, { ns: 'expenses' })}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {/* 2. Amount */}
          <Field label={t('new.amount.label')} required error={errors.amount} touched={touched.amount}>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#71717A] select-none pointer-events-none">
                $
              </span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                onBlur={() => touch('amount')}
                placeholder={t('new.amount.placeholder')}
                className={`${inputCls} pl-7`}
              />
            </div>
          </Field>

          {/* 3. Project */}
          <Field label={t('new.project.label')} required error={errors.project} touched={touched.project}>
            {projectsError ? (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                <span className="text-sm text-red-700">{t('new.project.loadError', 'Failed to load projects. Check your connection.')}</span>
                <button
                  type="button"
                  onClick={() => {
                    setProjectsError(false);
                    getMyProjects()
                      .then(list => { setProjects(list.map(p => ({ id: p.id, name: p.name, status: p.status }))); setProjectsError(false); })
                      .catch(() => setProjectsError(true));
                  }}
                  className="ml-auto text-xs font-medium text-red-700 underline"
                >
                  {t('new.project.retry', 'Retry')}
                </button>
              </div>
            ) : (
              <Select
                value={project}
                onValueChange={v => { setProject(v); touch('project'); }}
              >
                <SelectTrigger className="h-10 border-[#D4D4D8] text-sm">
                  <SelectValue placeholder={t('new.project.placeholder')} />
                </SelectTrigger>
                <SelectContent>
                  {projects.map(p => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                      {isProjectClosed(p) && <span className="ml-1 text-red-600 text-[10px] font-semibold">{t('new.closed')}</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>

          {/* 4. Date */}
          <Field label={t('new.date.label')} required error={errors.date} touched={touched.date}>
            <input
              type="date"
              value={date}
              max={getTodayISO()}
              onChange={e => { setDate(e.target.value); touch('date'); }}
              onBlur={() => touch('date')}
              className={inputCls}
            />
          </Field>

          {/* 5. Receipt Photo */}
          <Field label={t('new.receipt.label')} required error={errors.receiptFile} touched={touched.receiptFile}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              onChange={handleFileInputChange}
            />

            {!receiptFile ? (
              /* Dropzone */
              <div
                onClick={() => { fileInputRef.current?.click(); touch('receiptFile'); }}
                onDrop={handleDrop}
                onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                className={`h-40 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors select-none ${
                  isDragOver
                    ? 'border-[#F97316] bg-[#F97316]/5'
                    : 'border-[#D4D4D8] hover:border-[#F97316] hover:bg-[#F97316]/5'
                }`}
              >
                <Camera className="w-12 h-12 text-[#71717A]" />
                <p className="text-sm font-medium text-[#0A0A0A]">{t('new.receipt.dropzone')}</p>
                <p className="text-xs text-[#71717A]">{t('new.receipt.formats')}</p>
              </div>
            ) : (
              /* File preview */
              <div className="space-y-2">
                {receiptPreview ? (
                  <img
                    src={receiptPreview}
                    alt="Receipt preview"
                    className="w-full h-48 object-cover rounded-xl border border-[#D4D4D8]"
                  />
                ) : (
                  <div className="h-16 bg-[#FAFAFA] border border-[#D4D4D8] rounded-xl flex items-center gap-3 px-4">
                    <div className="w-8 h-8 bg-[#F97316]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4 text-[#F97316]" />
                    </div>
                    <span className="text-sm text-[#0A0A0A] truncate flex-1">{receiptFile.name}</span>
                  </div>
                )}
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs text-[#71717A] truncate max-w-[220px]">{receiptFile.name}</span>
                    <span className="text-[11px] text-[#D4D4D8] flex-shrink-0">·</span>
                    <span className="text-xs text-[#71717A] flex-shrink-0">{formatFileSize(receiptFile.size)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    className="flex items-center gap-1 text-xs text-[#d4183d] hover:text-red-700 transition-colors px-2 py-1 rounded hover:bg-red-50 flex-shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                    {t('new.remove')}
                  </button>
                </div>
              </div>
            )}
          </Field>

          {/* 6. Comment (optional) */}
          <Field label={t('new.notes.label')}>
            <Textarea
              value={comment}
              onChange={e => setComment(e.target.value.slice(0, 500))}
              placeholder={t('new.notes.placeholder')}
              className="resize-none text-sm border-[#D4D4D8] placeholder:text-[#71717A] min-h-[88px] focus:ring-2 focus:ring-[#F97316]/25 focus:border-[#F97316]"
              rows={3}
            />
            <p className="text-xs text-[#71717A] text-right">{comment.length}/500</p>
          </Field>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#FAFAFA]">
            <Button
              type="button"
              variant="outline"
              onClick={handleReset}
              disabled={isSubmitting}
              className="border-[#D4D4D8] text-[#0A0A0A] hover:text-[#F97316] hover:border-[#F97316] h-10 px-5 text-sm"
            >
              {t('buttons.cancel', { ns: 'common' })}
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-[#F97316] hover:bg-[#C2410C] text-white h-10 px-5 text-sm gap-2"
            >
              {isSubmitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" />{t('new.submitting')}</>
              ) : (
                <><Send className="w-4 h-4" />{t('new.submit')}</>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}