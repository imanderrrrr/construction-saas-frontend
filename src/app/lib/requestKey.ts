/**
 * A fresh key for one money movement the person means to make.
 *
 * The payment endpoints accept a `requestKey`: the same key sent twice books
 * the payment once (the server answers the first one again), and the same key
 * with different data is a 409. So a window creates ONE key when it opens on a
 * document, reuses it for every retry of that submit — a double click, or a
 * response lost on a bad connection — and drops it once the payment is booked,
 * so the next payment of the same document gets its own.
 *
 * `crypto.randomUUID` only exists in secure contexts (https, localhost); the
 * fallback keeps a panel opened over plain http on a LAN working.
 */
export function newRequestKey(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === 'function') {
    c.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
