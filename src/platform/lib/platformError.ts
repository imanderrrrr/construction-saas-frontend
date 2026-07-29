/**
 * Pull a displayable message off whatever `platformApi` threw. The wrapper
 * always rejects with a `PlatformApiError` carrying the backend's `message`,
 * but this stays defensive: a network failure mid-flight rejects with a plain
 * Error, and a dialog that renders "[object Object]" at a support engineer is
 * worse than one that renders its own fallback.
 */
export function extractMessage(err: unknown): string | null {
  if (err && typeof err === 'object' && 'message' in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === 'string') return m;
  }
  return null;
}
