// BuildTrack — "is this session still on a temporary password?"
//
// One module-level answer, shared by the three places that learn it:
//   * login, which is told in the LoginResponse;
//   * PasswordChangeGuard, which asks /auth/me when a session was restored
//     from its cookie and no LoginResponse was ever seen;
//   * the api() error path, which finds out the hard way when a request comes
//     back PASSWORD_CHANGE_REQUIRED.
//
// It is cached rather than re-fetched per navigation because the guard sits on
// every protected route, and asking /auth/me on each one would add a round trip
// to every click for the ~all users who are not blocked.
//
// The server stays the authority — this only decides what to render. Anything
// the user actually tries is judged by TemporaryPasswordFilter, so a stale
// `false` here costs a redirect, never access.

/** null = not known yet in this tab; ask the server. */
let cached: boolean | null = null;

export function getPasswordChangeRequired(): boolean | null {
  return cached;
}

export function setPasswordChangeRequired(value: boolean): void {
  cached = value;
}

/**
 * Forget the cached answer. Called on logout so the next person to sign in on
 * this browser is not judged by the previous user's state.
 */
export function clearPasswordChangeState(): void {
  cached = null;
}
