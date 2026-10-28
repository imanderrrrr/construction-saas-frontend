import { beforeEach } from 'vitest';
// A real serialized lock model, including overlapping requests in one test.
let tail: Promise<unknown> = Promise.resolve();
Object.defineProperty(navigator, 'locks', { configurable: true, value: {
  request: (_name: string, callback: () => Promise<unknown>) => {
    const next = tail.then(callback); tail = next.catch(() => {}); return next;
  },
} });
beforeEach(() => {
  localStorage.clear();
  document.cookie = `ofjr_session=${encodeURIComponent(JSON.stringify({ role: 'WAREHOUSE', username: 'keeper' }))}; Path=/`;
  document.cookie = 'bt_tenant=test-a; Path=/';
  tail = Promise.resolve();
});
