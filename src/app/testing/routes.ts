// Test helper: pages are lazy chunks now (AUD-019), so a test that mounts the
// real route table has to let the page arrive before asserting on it.

import { act } from 'react';

/**
 * Waits until no route is showing its loading state. Bounded by time, not by
 * ticks: the first import of a page transforms its whole module graph.
 */
export async function settleRoutes(container: ParentNode = document.body, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  do {
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 5)); });
    if (!container.querySelector('[data-route-loading]')) return;
  } while (Date.now() < deadline);
  throw new Error('a route is still loading');
}
