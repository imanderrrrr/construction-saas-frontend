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
