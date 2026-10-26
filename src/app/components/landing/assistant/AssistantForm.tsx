import { useEffect, useId, useRef, useState, type FormEvent, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';

import { FIELD_LIMITS } from '../../../../shared/fieldLimits';
import type { LeadInterest } from '../../../services/landingAssistant';
import { AssistantNotice } from './AssistantNotice';
import { validateLead, type LeadFieldErrors, type LeadFormValues } from './leadForm';
import { ACTION_STRIP, BODY, BODY_GRID, BUTTON_PRIMARY, FOCUS_ON_LIGHT, MICRO_LABEL } from './recipes';
import type { NoticeKind } from './useAssistantChat';

type FieldName = keyof LeadFieldErrors;

const FIELD =
  'h-11 w-full rounded-[2px] border border-bt-field bg-bt-sheet px-3 text-[14.5px] text-bt-ink placeholder:text-bt-muted disabled:cursor-not-allowed max-sm:text-base';
const FIELD_ERROR = 'border-2 border-bt-red bg-[#fbf1ec] px-[11px]';

function Field({
  id,
  label,
  error,
  inputRef,
  autoFocusTarget,
  ...input
}: {
  id: string;
  label: string;
  error?: string;
  inputRef: RefObject<HTMLInputElement>;
  /** The field the panel focuses when the form opens. */
  autoFocusTarget?: boolean;
  value: string;
  placeholder: string;
  maxLength: number;
  autoComplete: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className={MICRO_LABEL}>
        {label}
      </label>
      <input
        ref={inputRef}
        id={id}
        type="text"
        data-autofocus={autoFocusTarget ? '' : undefined}
        value={input.value}
        placeholder={input.placeholder}
        maxLength={input.maxLength}
        autoComplete={input.autoComplete}
        disabled={input.disabled}
        onChange={(event) => input.onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`${FIELD} ${error ? FIELD_ERROR : ''} ${FOCUS_ON_LIGHT}`}
      />
      {error && (
        <p id={errorId} role="alert" className="flex items-start gap-1.5 text-[12.5px] font-medium leading-snug text-bt-red">
          <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden="true" className="mt-px flex-none">
            <circle cx="7" cy="7" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M7 4 V7.5 M7 9.6 V10" stroke="currentColor" strokeWidth="1.6" fill="none" />
          </svg>
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

/**
 * The contact form: name, company, one "email or phone" field, the interest
 * and the consent box — unchecked, and the only thing the submit button waits
 * for; every other rule is checked when it is pressed, so the visitor learns
 * what to fix instead of facing a dead button.
 *
 * `notice` is the panel's message about the last attempt (or, on the
 * "chat unavailable" sheet, the reason the form is showing at all).
 */
export function AssistantForm({
  initialInterest,
  submitting,
  notice,
  onSubmit,
}: {
  initialInterest: LeadInterest | null;
  submitting: boolean;
  notice: NoticeKind | null;
  onSubmit: (values: LeadFormValues) => Promise<LeadFieldErrors | null>;
}) {
  const { t } = useTranslation('landing');
  const id = useId();
  const [values, setValues] = useState<LeadFormValues>({
    name: '',
    company: '',
    contact: '',
    interest: initialInterest ?? 'DEMO',
    consent: false,
  });
  const [errors, setErrors] = useState<LeadFieldErrors>({});
  // Set at once, before React re-renders: a double click or a held Enter fires twice in one frame.
  const pending = useRef(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const companyRef = useRef<HTMLInputElement>(null);
  const contactRef = useRef<HTMLInputElement>(null);

  // A new notice is announced at the top of the sheet: bring it into view.
  useEffect(() => {
    if (notice && bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [notice]);

  const errorText: Record<NonNullable<LeadFieldErrors[FieldName]>, string> = {
    name: t('assistant.form.error.name'),
    company: t('assistant.form.error.company'),
    contact: t('assistant.form.error.contact'),
    email: t('assistant.form.error.email'),
    phone: t('assistant.form.error.phone'),
  };

  function change(field: FieldName, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => (current[field] ? { ...current, [field]: undefined } : current));
  }

  async function submitValues() {
    if (pending.current || submitting || !values.consent) return;
    const found = validateLead(values);
    const firstInvalid = (['name', 'company', 'contact'] as const).find((field) => found[field]);
    if (firstInvalid) {
      setErrors(found);
      ({ name: nameRef, company: companyRef, contact: contactRef })[firstInvalid].current?.focus();
      return;
    }
    pending.current = true;
    try {
      const serverErrors = await onSubmit(values);
      if (serverErrors) setErrors(serverErrors);
    } finally {
      pending.current = false;
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitValues();
  }

  const interests: Array<{ value: LeadInterest; label: string }> = [
    { value: 'DEMO', label: t('assistant.form.interest.demo') },
    { value: 'BETA', label: t('assistant.form.interest.beta') },
  ];

  return (
    <form noValidate onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
      <div ref={bodyRef} className={BODY} style={BODY_GRID}>
        {notice && <AssistantNotice kind={notice} onRetry={() => void submitValues()} />}

        <Field
          id={`${id}-name`}
          inputRef={nameRef}
          autoFocusTarget
          label={t('assistant.form.name.label')}
          placeholder={t('assistant.form.name.placeholder')}
          maxLength={FIELD_LIMITS.PERSON_NAME}
          autoComplete="name"
          value={values.name}
          disabled={submitting}
          error={errors.name && errorText[errors.name]}
          onChange={(value) => change('name', value)}
        />
        <Field
          id={`${id}-company`}
          inputRef={companyRef}
          label={t('assistant.form.company.label')}
          placeholder={t('assistant.form.company.placeholder')}
          maxLength={FIELD_LIMITS.COMPANY_NAME}
          autoComplete="organization"
          value={values.company}
          disabled={submitting}
          error={errors.company && errorText[errors.company]}
          onChange={(value) => change('company', value)}
        />
        <Field
          id={`${id}-contact`}
          inputRef={contactRef}
          label={t('assistant.form.contact.label')}
          placeholder={t('assistant.form.contact.placeholder')}
          maxLength={FIELD_LIMITS.EMAIL}
          autoComplete="email"
          value={values.contact}
          disabled={submitting}
          error={errors.contact && errorText[errors.contact]}
          onChange={(value) => change('contact', value)}
        />

        <div className="flex flex-col gap-1">
          <span id={`${id}-interest`} className={MICRO_LABEL}>
            {t('assistant.form.interest.label')}
          </span>
          <div
            role="radiogroup"
            aria-labelledby={`${id}-interest`}
            className="flex overflow-hidden rounded-[2px] border border-bt-ink"
          >
            {interests.map((option) => (
              <label key={option.value} className="relative flex-1 cursor-pointer">
                <input
                  type="radio"
                  name={`${id}-interest`}
                  value={option.value}
                  checked={values.interest === option.value}
                  disabled={submitting}
                  onChange={() => setValues((current) => ({ ...current, interest: option.value }))}
                  className="peer sr-only"
                />
                <span className="flex h-[42px] items-center justify-center bg-bt-sheet text-sm font-semibold text-bt-ink peer-checked:bg-bt-ink peer-checked:text-bt-bone peer-focus-visible:outline-2 peer-focus-visible:-outline-offset-4 peer-focus-visible:outline-bt-ink peer-checked:peer-focus-visible:outline-bt-orange">
                  {option.label}
                </span>
              </label>
            ))}
          </div>
        </div>

        <label className="flex min-h-11 cursor-pointer items-start gap-3 text-[12.5px] leading-normal text-bt-brown">
          <input
            type="checkbox"
            checked={values.consent}
            disabled={submitting}
            onChange={(event) => {
              const consent = event.target.checked;
              setValues((current) => ({ ...current, consent }));
            }}
            className={`m-0 size-[22px] flex-none accent-bt-ink ${FOCUS_ON_LIGHT}`}
          />
          <span>
            {t('assistant.form.consent')}{' '}
            <a
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-bt-ink underline underline-offset-2"
            >
              {t('assistant.form.consent.link')}
            </a>
          </span>
        </label>
      </div>

      <div className={ACTION_STRIP}>
        <button
          type="submit"
          disabled={!values.consent}
          aria-disabled={submitting || undefined}
          className={`${BUTTON_PRIMARY} disabled:cursor-not-allowed disabled:border disabled:border-bt-rule-4 disabled:bg-bt-paper-2 disabled:text-bt-muted disabled:hover:bg-bt-paper-2`}
        >
          {submitting ? (
            <>
              <span
                aria-hidden="true"
                className="size-3.5 flex-none animate-spin rounded-full border-2 border-bt-ink/30 border-t-bt-ink motion-reduce:animate-none"
              />
              {t('assistant.form.sending')}
            </>
          ) : (
            t('assistant.form.submit')
          )}
        </button>
      </div>
    </form>
  );
}
