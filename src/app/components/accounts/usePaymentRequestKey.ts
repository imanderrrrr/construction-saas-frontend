import { useEffect, useRef } from 'react';

/** One intention per open document. Failed/ambiguous responses keep the key;
 * changed details with the same key are rejected by the server. Opening a new
 * dialog after completion is a new, potentially identical, partial payment.
 */
export function usePaymentRequestKey(documentId: number | null) {
  const key = useRef<string | null>(null);
  useEffect(() => { key.current = null; }, [documentId]);
  return () => {
    key.current ??= crypto.randomUUID();
    return key.current;
  };
}
