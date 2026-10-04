import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useBlocker } from 'react-router';
import { useTranslation } from 'react-i18next';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../components/ui/alert-dialog';

const DraftContext = createContext<((id: symbol) => () => void) | null>(null);

export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation('common');
  const drafts = useRef(new Set<symbol>());
  const [count, setCount] = useState(0);
  const register = useCallback((id: symbol) => {
    drafts.current.add(id); setCount(drafts.current.size);
    return () => { drafts.current.delete(id); setCount(drafts.current.size); };
  }, []);
  const blocker = useBlocker(({ currentLocation, nextLocation }) => drafts.current.size > 0 && currentLocation.pathname !== nextLocation.pathname);
  useEffect(() => {
    if (!count) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [count]);
  return <DraftContext.Provider value={register}>
    {children}
    <AlertDialog open={blocker.state === 'blocked'}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>{t('workspace.unsavedTitle')}</AlertDialogTitle><AlertDialogDescription>{t('workspace.unsavedBody')}</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => blocker.reset?.()}>{t('workspace.keepEditing')}</AlertDialogCancel>
          <AlertDialogAction onClick={() => { drafts.current.clear(); setCount(0); blocker.proceed?.(); }}>{t('workspace.discardAndLeave')}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </DraftContext.Provider>;
}

/** Returns an immediate release for successful saves before a route change. */
export function useUnsavedChanges(dirty: boolean) {
  const register = useContext(DraftContext);
  const id = useMemo(() => Symbol('draft'), []);
  const release = useRef<(() => void) | undefined>();
  useEffect(() => {
    if (!dirty || !register) return;
    release.current = register(id);
    return () => { release.current?.(); release.current = undefined; };
  }, [dirty, id, register]);
  return useCallback(() => release.current?.(), []);
}
