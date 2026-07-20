// Vitest global setup (registered in vitest.config.ts).
//
// Node 22+ ships an experimental `localStorage` global; without a valid
// `--localstorage-file` it is a non-functional placeholder (plain object, no
// getItem/setItem/removeItem) and it SHADOWS jsdom's real Storage inside the
// vitest environment. Any module that touches localStorage at import time —
// e.g. src/app/lib/api.ts's legacy-token purge — then crashes every test file
// that imports it, which is why the whole suite failed to collect.
// Install a functional in-memory Storage before test files (and the app
// modules they import) load. Each test file gets a fresh instance.

class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number { return this.store.size; }
  clear(): void { this.store.clear(); }
  getItem(key: string): string | null { return this.store.get(key) ?? null; }
  key(index: number): string | null { return [...this.store.keys()][index] ?? null; }
  removeItem(key: string): void { this.store.delete(key); }
  setItem(key: string, value: string): void { this.store.set(key, String(value)); }
}

function isFunctional(candidate: unknown): candidate is Storage {
  try {
    const s = candidate as Storage | null | undefined;
    return typeof s?.getItem === 'function'
      && typeof s?.setItem === 'function'
      && typeof s?.removeItem === 'function';
  } catch {
    return false; // some environments throw on mere access (opaque origins)
  }
}

for (const name of ['localStorage', 'sessionStorage'] as const) {
  if (!isFunctional((globalThis as unknown as Record<string, unknown>)[name])) {
    Object.defineProperty(globalThis, name, {
      value: new MemoryStorage(),
      writable: true,
      configurable: true,
    });
  }
}
