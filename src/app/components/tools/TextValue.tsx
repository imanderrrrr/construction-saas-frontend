/** Bounded text with a keyboard/touch disclosure for historical or external values. */
export function TextValue({ value, className = '' }: { value: string; className?: string }) {
  if (value.length <= 25) return <span className={`block min-w-0 truncate ${className}`} title={value}>{value}</span>;
  return <details className={`min-w-0 max-w-full ${className}`}>
    <summary className="truncate cursor-pointer focus-visible:outline-2" title={value}>{value}</summary>
    <span className="block whitespace-normal [overflow-wrap:anywhere] py-1">{value}</span>
  </details>;
}
