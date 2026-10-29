import { useEffect, useState } from 'react';
import { warehouseScope } from './warehouseIntent';

/** A login in another tab must hide the previous account's pending payload. */
export function useWarehouseScope() {
  const [scope] = useState(warehouseScope);
  const [active, setActive] = useState(!!scope);
  useEffect(() => {
    const check = () => { if (warehouseScope() !== scope) setActive(false); };
    window.addEventListener('storage', check);
    window.addEventListener('focus', check);
    return () => {
      window.removeEventListener('storage', check);
      window.removeEventListener('focus', check);
    };
  }, [scope]);
  return { scope, active };
}
