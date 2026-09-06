import { forwardRef, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '../ui/utils';
import { FOCUS_RING } from '../onboarding/chrome';
import { FieldError, FieldHint, FieldLabel, INPUT, INPUT_ERROR } from '../projects/bt';

/**
 * A password field of the panel: mono label, square input, the eye that
 * starts CLOSED (dots, like the login), and one line under it — the error
 * when there is one, the hint otherwise. Works with react-hook-form's
 * `register()` spread (ref, name, onChange, onBlur).
 */
export const PasswordField = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  /** 40 px on pages, 38 px inside drawers (as the Proyectos windows do). */
  compact?: boolean;
}>(function PasswordField({ id, label, hint, error, className, disabled, compact = false, ...rest }, ref) {
  const { t } = useTranslation('auth');
  const [shown, setShown] = useState(false);
  const height = compact ? 'h-[38px]' : 'h-10';
  return (
    <div>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="flex">
        <input
          ref={ref}
          id={id}
          type={shown ? 'text' : 'password'}
          disabled={disabled}
          aria-invalid={error ? 'true' : 'false'}
          className={cn(INPUT, height, 'flex-1 min-w-0', error && INPUT_ERROR, className)}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setShown(s => !s)}
          aria-label={shown ? t('login.password.hide') : t('login.password.show')}
          aria-pressed={shown}
          tabIndex={-1}
          disabled={disabled}
          className={cn('w-[38px] flex-shrink-0 flex items-center justify-center border border-l-0 border-[#DBD0BB] bg-[#FAF7F0] text-[#5A5346] hover:text-[#C2410C] disabled:opacity-75', height, FOCUS_RING)}
        >
          {shown ? <EyeOff className="w-4 h-4" strokeWidth={1.8} /> : <Eye className="w-4 h-4" strokeWidth={1.8} />}
        </button>
      </div>
      {error
        ? <FieldError>{error}</FieldError>
        : hint ? <FieldHint className="normal-case tracking-normal">{hint}</FieldHint> : null}
    </div>
  );
});
