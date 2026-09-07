import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../ui/utils';
import { FIELD_LIMITS } from '../../../shared/fieldLimits';
import { createTool, getAdminTools, updateTool, type ToolResponse } from '../../services/warehouse';
import { BtModal } from '../bt/windows';
import { FOCUS_RING, PrimaryButton, SecondaryButton } from '../onboarding/chrome';
import { FieldError, FieldHint, FieldLabel, INPUT, INPUT_ERROR, Mono, PaperNote } from '../projects/bt';
import { CATEGORIES, categoryName, StatusChip } from './bits';

/**
 * 05 / 06 — register and edit a tool, the same 560 px window.
 *
 * Without a warehouse user there was nobody in the company who could add a
 * drill: the server has always allowed the admin to do it and the screen said
 * "read only". Four fields, and it starts Available — the state is not chosen,
 * because a tool just registered is in the warehouse by definition.
 *
 * Three differences when editing: the code cannot change (it is on the label
 * stuck to the machine and in every checkout of its history), the fields sit on
 * white, and the header says the state and who has it, because editing a tool
 * that is out is normal and worth knowing before you type.
 */

const MAX_CODE = FIELD_LIMITS.CODE;
const MAX_NOTES = FIELD_LIMITS.NOTE;

interface Errors {
  code?: string;
  name?: string;
  category?: string;
  server?: string;
}

export function ToolFormModal({ open, onOpenChange, tool, onSaved }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Null to register. */
  tool: ToolResponse | null;
  onSaved: (tool: ToolResponse, mode: 'create' | 'edit') => void;
}) {
  const { t } = useTranslation(['tools', 'common']);
  const editing = tool != null;

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [taken, setTaken] = useState<ToolResponse | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCode(tool?.code ?? '');
    setName(tool?.name ?? '');
    setCategory(tool?.category ?? CATEGORIES[0]);
    setNotes(tool?.notes ?? '');
    setErrors({});
    setTaken(null);
    setSaving(false);
  }, [open, tool]);

  /**
   * The code is checked twice: here on blur, so the answer arrives before the
   * button is pressed and with the name of the tool that holds it, and again
   * by the server, which is the only one that can really know.
   */
  const checkCode = async () => {
    const value = code.trim().toUpperCase();
    if (!value || editing) return;
    try {
      const page = await getAdminTools({ search: value, size: 5 });
      const hit = page.content.find(t2 => t2.code.toUpperCase() === value);
      if (hit) {
        setTaken(hit);
        setErrors(e => ({ ...e, code: t('tools:form.code.taken') }));
      } else {
        setTaken(null);
        setErrors(e => ({ ...e, code: undefined }));
      }
    } catch {
      /* the server checks again on submit; nothing is lost by staying quiet */
    }
  };

  const submit = async () => {
    const next: Errors = {};
    const value = code.trim().toUpperCase();
    if (!editing && !value) next.code = t('tools:form.err.code');
    if (!name.trim()) next.name = t('tools:form.err.name');
    if (!category) next.category = t('tools:form.err.category');
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      const saved = editing
        ? await updateTool(tool.id, { name: name.trim(), category, notes: notes.trim() || undefined })
        : await createTool({ code: value, name: name.trim(), category, notes: notes.trim() || undefined });
      onSaved(saved, editing ? 'edit' : 'create');
      onOpenChange(false);
    } catch (err) {
      // A duplicate code is the one failure the server alone can decide.
      const message = err instanceof Error ? err.message : '';
      if (/code/i.test(message) && /exist/i.test(message)) setErrors({ code: t('tools:form.code.taken') });
      else setErrors({ server: t('tools:form.err.server') });
    } finally {
      setSaving(false);
    }
  };

  const fieldBg = editing ? 'bg-white' : 'bg-[#FAF7F0]';

  return (
    <BtModal
      open={open}
      onOpenChange={onOpenChange}
      width={560}
      dismissible={false}
      closeDisabled={saving}
      kicker={editing ? t('tools:form.kicker.edit') : t('tools:form.kicker.new')}
      title={editing ? t('tools:form.title.edit') : t('tools:form.title.new')}
      footer={
        <>
          <Mono className="text-[9px] tracking-[0.08em] text-[#A69C8D] md:mr-auto">
            {editing ? t('tools:form.footer.edit') : t('tools:form.footer.new')}
          </Mono>
          <SecondaryButton onClick={() => onOpenChange(false)} disabled={saving}>{t('common:buttons.cancel')}</SecondaryButton>
          <PrimaryButton onClick={submit} disabled={saving}>
            {saving
              ? (editing ? t('tools:form.submitting.edit') : t('tools:form.submitting.new'))
              : (editing ? t('tools:form.submit.edit') : t('tools:form.submit.new'))}
          </PrimaryButton>
        </>
      }
    >
      {editing && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <StatusChip status={tool.status} />
          {tool.assignedTo && <Mono className="text-[9.5px] tracking-[0.08em] text-[#5A5346]">{tool.assignedTo}</Mono>}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-[14px]">
        <div>
          <FieldLabel htmlFor="tool-code" required={!editing}>{t('tools:form.code')}</FieldLabel>
          {editing ? (
            <>
              <div className="w-full h-10 border border-[#DBD0BB] bg-[#F3EEE4] px-3 flex items-center justify-between gap-2">
                <Mono className="text-[13px] font-semibold tracking-[0.05em] text-[#8A8175]">{tool.code}</Mono>
                <Mono className="text-[9px] tracking-[0.1em] text-[#A69C8D]">{t('tools:form.code.fixed')}</Mono>
              </div>
              <FieldHint>{t('tools:form.code.fixedHint')}</FieldHint>
            </>
          ) : (
            <>
              <input
                id="tool-code"
                value={code}
                onChange={e => { setCode(e.target.value.toUpperCase().replace(/\s/g, '')); setTaken(null); setErrors(x => ({ ...x, code: undefined })); }}
                onBlur={checkCode}
                maxLength={MAX_CODE}
                className={cn(INPUT, fieldBg, 'font-bt-mono text-[13px] tracking-[0.05em] uppercase', errors.code && INPUT_ERROR)}
              />
              {errors.code ? <FieldError>{errors.code}</FieldError> : <FieldHint>{t('tools:form.code.hint', { max: MAX_CODE })}</FieldHint>}
            </>
          )}
        </div>
        <div>
          <FieldLabel htmlFor="tool-name" required>{t('tools:form.name')}</FieldLabel>
          <input
            id="tool-name"
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={FIELD_LIMITS.SHORT_NAME}
            className={cn(INPUT, fieldBg, errors.name && INPUT_ERROR)}
          />
          {errors.name ? <FieldError>{errors.name}</FieldError> : <FieldHint>{t('tools:form.name.hint')}</FieldHint>}
        </div>
      </div>

      {taken && !editing && (
        <PaperNote tone="red" className="mt-2.5">
          {t('tools:form.code.takenBody', { code: taken.code, name: taken.name })}
        </PaperNote>
      )}

      <div className="mt-[14px]">
        <FieldLabel required>{t('tools:form.category')}</FieldLabel>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-[7px]">
          {CATEGORIES.map((c, i) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              aria-pressed={category === c}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2.5 border text-left transition-colors',
                i === CATEGORIES.length - 1 && 'md:col-span-2',
                category === c ? 'bg-[#0B0A09] text-[#F5F1E8] border-[#0B0A09]' : 'bg-white border-[#DBD0BB] text-[#0B0A09] hover:border-[#F97316]',
                FOCUS_RING,
              )}
            >
              <span className={cn('w-[11px] h-[11px] flex-shrink-0', category === c ? 'bg-[#F97316]' : 'border border-[#DBD0BB]')} aria-hidden="true" />
              <span className="text-[12.5px]">{categoryName(t, c)}</span>
            </button>
          ))}
        </div>
        {errors.category && <FieldError>{errors.category}</FieldError>}
        <PaperNote tone="none" className="mt-2.5 border-l-[3px] border-l-[#0B0A09]">
          {editing ? t('tools:form.category.hintEdit') : t('tools:category.enumNote')}
        </PaperNote>
      </div>

      <div className="mt-[14px]">
        <FieldLabel htmlFor="tool-notes">{t('tools:form.notes')}</FieldLabel>
        <textarea
          id="tool-notes"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          maxLength={MAX_NOTES}
          rows={3}
          className={cn(INPUT, fieldBg, 'h-[70px] resize-none py-2 leading-[1.5]')}
        />
        <div className="flex items-start justify-between gap-3">
          <FieldHint>{t('tools:form.notes.hint')}</FieldHint>
          <Mono className="text-[9.5px] tracking-[0.04em] tabular-nums text-[#A69C8D] mt-[5px]">{notes.length} / {MAX_NOTES}</Mono>
        </div>
      </div>

      {errors.server && <PaperNote tone="red" className="mt-4">{errors.server}</PaperNote>}
    </BtModal>
  );
}
