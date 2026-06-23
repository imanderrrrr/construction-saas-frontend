// Ambient globals used by the test environment.
//
// React reads `globalThis.IS_REACT_ACT_ENVIRONMENT` to decide whether to
// suppress `act(...)` warnings. The test setup assigns it directly, so it is
// declared here to keep `tsc --noEmit` clean without sprinkling casts across
// every test file.
export {};

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
