import { cn } from '../ui/utils';
import { FIELD_LIMITS } from '../../../shared/fieldLimits';
import { FieldError, FieldLabel, INPUT, INPUT_ERROR } from './bt';

/**
 * Type-the-name challenge of the irreversible windows (04C close, 04D
 * delete): the exact name in a copyable mono box, an input, and one line of
 * feedback — green only here, the one place the sheet allows it ("solo
 * confirmación de un reto escrito").
 */
export function NameChallenge({ id, name, value, onChange, label, placeholder, mismatchText, confirmedText, disabled }: {
  id: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  label: string;
  placeholder: string;
  mismatchText: string;
  confirmedText: string;
  disabled?: boolean;
}) {
  const isMatch = value.trim() === name;
  return (
    <div>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="border border-[#DBD0BB] bg-[#FAF7F0] px-3 py-2 font-bt-mono text-[12.5px] font-semibold text-[#0A0A0A] select-all break-all mb-2">{name}</div>
      <input
        id={id}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={FIELD_LIMITS.SHORT_NAME}
        disabled={disabled}
        autoComplete="off"
        className={cn(INPUT, 'h-[38px]', isMatch && 'border-[#2E7D4F]', value.length > 0 && !isMatch && INPUT_ERROR)}
      />
      {value.length > 0 && !isMatch && <FieldError>{mismatchText}</FieldError>}
      {isMatch && <p className="font-bt-mono text-[9.5px] tracking-[0.04em] uppercase font-semibold text-[#2E7D4F] mt-[5px]">{confirmedText}</p>}
    </div>
  );
}

export function nameMatches(value: string, name: string): boolean {
  return value.trim() === name;
}
