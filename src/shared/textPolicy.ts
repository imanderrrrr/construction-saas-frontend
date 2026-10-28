/** Omit unchanged values when editing, including text saved before the current limits. */
export function changedFields<T extends object>(current: T, original: Partial<T>): Partial<T> {
  return Object.fromEntries(
    Object.entries(current).filter(([key, value]) => value !== original[key as keyof T]),
  ) as Partial<T>;
}

/** Historical text can be kept intact; a new value must satisfy the current policy. */
export function textTooLong(value: string, max: number, original?: string | null): boolean {
  return value !== original && value.length > max;
}

/** Display preview only; never use it to alter a payload or stored text. */
export function textPreview(value: string, max = 25): string {
  return value.length <= max ? value : `${value.slice(0, max).replace(/[\uD800-\uDBFF]$/u, '')}…`;
}
