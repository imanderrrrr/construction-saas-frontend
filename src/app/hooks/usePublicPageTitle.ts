import { useEffect } from 'react';

/**
 * Sets `document.title` while a public page is mounted, and puts the previous
 * title back on unmount.
 *
 * The landing, docs and status pages each name themselves, and re-title
 * themselves when the reader switches ES/EN — pass a translated string and the
 * effect re-runs on language change. Restoring on unmount keeps the title from
 * leaking into the authenticated app when someone navigates onward.
 */
export function usePublicPageTitle(title: string): void {
  useEffect(() => {
    const previous = document.title;
    document.title = title;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
