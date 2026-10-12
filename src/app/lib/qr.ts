// The QR library, fetched the first time a code is drawn (AUD-019) instead
// of riding along with every screen that might draw one. A failed fetch is
// forgotten so the next attempt tries again; callers keep their own fallback
// (the plain link, the token as text) through the promise's rejection.

type QRCodeModule = typeof import('qrcode');

let pending: Promise<QRCodeModule> | undefined;

export function loadQrCode(): Promise<QRCodeModule> {
  pending ??= import('qrcode')
    .then(m => ((m as { default?: QRCodeModule }).default ?? m) as QRCodeModule)
    .catch(error => { pending = undefined; throw error; });
  return pending;
}
