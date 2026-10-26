import { useScreenState } from '../../app/workspace/WorkspaceState';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { Trash2 } from 'lucide-react';

import { usePlatformAuth } from '../context/PlatformAuthContext';
import { deleteLead, listLeads } from '../services/platformLeads';
import type { Page, PlatformLead } from '../types';
import { fmtDate, fmtTime } from '../../app/helpers/dateTime';
import { PlatformModal } from '../components/PlatformModal';
import {
  cardCx,
  chipCx,
  colHeadCx,
  dangerBtnCx,
  errorBoxCx,
  microLabelCx,
  pageTitleCx,
  secondaryBtnCx,
  Skeleton,
} from '../components/console';

const PAGE_SIZE = 25;

// This page reads its mono labels in `bt-muted` (6.0:1) instead of the shared
// `bt-muted-2` (2.75:1). Swapped, not appended: two colour utilities on one
// element resolve by stylesheet order, not by className order.
const headCx = colHeadCx.replace('text-bt-muted-2', 'text-bt-muted');
const retentionCx = microLabelCx.replace('text-bt-muted-2', 'text-bt-muted');
const interestChipCx = chipCx.replace('inline-block', 'inline-flex items-center gap-1.5');

/**
 * Name 150 · Company and Contact share what is left · Interest 100 · Language 90 · Source 80 · Received 130 ·
 * actions 56. The design's 230 + 230 assumed a 1072 px content column; at a 1440 px window the console gives
 * about 980, and fixed widths would push Received and the delete button out of the card.
 */
const COLUMN_WIDTHS: Array<number | undefined> = [150, undefined, undefined, 100, 90, 80, 130, 56];

const SUBTITLE = 'Contacts left on the public landing page, through the assistant or the contact form.';

/**
 * Contacts left on the public landing — through the assistant or its contact
 * form. Everyone on the console can read them; only OWNER deletes. The server
 * audits both, and drops every lead after 12 months on its own.
 */
export function PlatformLeads() {
  const { role } = usePlatformAuth();
  const canDelete = role === 'OWNER';
  const [page, setPage] = useScreenState('pagina', 0);
  const [reload, setReload] = useState(0);
  const [toDelete, setToDelete] = useState<PlatformLead | null>(null);
  // The answer remembers which request it belongs to: a page or a reload that
  // has not answered yet reads as loading, with no state to reset by hand.
  const [result, setResult] = useState<{ key: string; data?: Page<PlatformLead> } | null>(null);
  const requestKey = `${page}:${reload}`;

  useEffect(() => {
    let cancelled = false;
    listLeads(page, PAGE_SIZE)
      .then(data => { if (!cancelled) setResult({ key: requestKey, data }); })
      .catch(() => { if (!cancelled) setResult({ key: requestKey }); });
    return () => { cancelled = true; };
  }, [page, requestKey]);

  const loading = result?.key !== requestKey;
  const data = loading ? null : result?.data ?? null;
  const error = !loading && !data;
  const totalPages = data?.totalPages ?? 0;
  const rows = data?.content ?? [];

  const afterDelete = () => {
    setToDelete(null);
    // The last row of a later page is gone: that page no longer exists.
    if (rows.length === 1 && page > 0) setPage(page - 1);
    else setReload(n => n + 1);
  };

  return (
    <>
      <header className="flex items-end justify-between gap-6">
        <div>
          <h1 className={pageTitleCx}>Leads</h1>
          <p className="mt-2.5 text-sm text-bt-muted">
            {loading ? 'Loading…' : data ? `${SUBTITLE} ${data.totalElements} total` : SUBTITLE}
          </p>
        </div>
        <span className={`${retentionCx} flex-none pb-1`}>AUTO-DELETED AFTER 12 MONTHS</span>
      </header>

      {error && (
        <div role="alert" className={`${errorBoxCx} mt-6 flex items-center justify-between gap-4`}>
          <span>Failed to load leads.</span>
          <button type="button" onClick={() => setReload(n => n + 1)} className={secondaryBtnCx}>
            Retry
          </button>
        </div>
      )}

      <div className={`${cardCx} mt-6 overflow-hidden`}>
        <table className="w-full table-fixed text-sm">
          <colgroup>
            {COLUMN_WIDTHS.map((width, i) => <col key={i} style={{ width }} />)}
          </colgroup>
          <thead>
            <tr className={`text-left ${headCx}`}>
              <th className="px-6 pb-2.5 pt-4 font-semibold">Name</th>
              <th className="px-4 pb-2.5 pt-4 font-semibold">Company</th>
              <th className="px-4 pb-2.5 pt-4 font-semibold">Contact</th>
              <th className="px-4 pb-2.5 pt-4 font-semibold">Interest</th>
              <th className="px-4 pb-2.5 pt-4 font-semibold">Language</th>
              <th className="px-4 pb-2.5 pt-4 font-semibold">Source</th>
              <th className="px-4 pb-2.5 pt-4 font-semibold">Received</th>
              <th className="px-2 pb-2.5 pt-4 font-semibold"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {loading &&
              Array.from({ length: 4 }, (_, i) => (
                <tr key={`s${i}`} className="h-14 border-t border-bt-rule-3">
                  {COLUMN_WIDTHS.map((_, j) => (
                    <td key={j} className="px-4 first:pl-6">
                      {j < 7 && <Skeleton className={j === 3 ? 'h-5 w-14 rounded-md' : 'h-3.5 w-20'} />}
                    </td>
                  ))}
                </tr>
              ))}
            {!loading && !error && rows.length === 0 && (
              <tr className="border-t border-bt-rule-3">
                <td colSpan={8} className="px-6 py-8 text-bt-muted">
                  <div className="font-semibold text-bt-ink">No leads yet.</div>
                  <div className="mt-1">Contacts from the landing assistant and form will appear here.</div>
                </td>
              </tr>
            )}
            {!loading &&
              rows.map(lead => (
                <tr key={lead.id} className="h-14 border-t border-bt-rule-3 transition-colors hover:bg-[#F9F5EC]">
                  <td className="truncate px-6 font-semibold text-bt-ink" title={lead.name}>{lead.name}</td>
                  <td className="truncate px-4 text-bt-ink" title={lead.company}>{lead.company}</td>
                  <td className="truncate px-4 font-bt-mono text-xs text-bt-ink">{lead.email ?? lead.phone ?? '—'}</td>
                  <td className="px-4">
                    <span data-interest={lead.interest} className={interestChipCx}>
                      <i aria-hidden="true" className={`block size-1.5 flex-none ${lead.interest === 'DEMO' ? 'bg-bt-orange' : 'bg-bt-ink'}`} />
                      {lead.interest}
                    </span>
                  </td>
                  <td className="px-4 font-bt-mono text-xs text-bt-muted">{lead.locale.toUpperCase()}</td>
                  <td className="px-4 font-bt-mono text-xs text-bt-muted">{lead.source}</td>
                  <td className="px-4 font-bt-mono text-xs leading-tight">
                    <div className="text-bt-ink">{fmtDate(lead.createdAt)}</div>
                    <div className="text-bt-muted">{fmtTime(lead.createdAt)}</div>
                  </td>
                  <td className="px-1">
                    {canDelete && (
                      <button
                        type="button"
                        aria-label={`Delete lead ${lead.name}`}
                        onClick={() => setToDelete(lead)}
                        className="inline-flex size-10 cursor-pointer items-center justify-center rounded-lg text-bt-muted transition-colors hover:bg-[#FAEDE7] hover:text-[#B42318]"
                      >
                        <Trash2 size={16} strokeWidth={1.8} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <span className="font-bt-mono text-[11px] font-semibold tracking-[0.1em] text-bt-muted">
            PAGE {page + 1} OF {totalPages}
          </span>
          <div className="flex gap-2">
            <button type="button" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0 || loading} className={secondaryBtnCx}>Previous</button>
            <button type="button" onClick={() => setPage(p => p + 1)} disabled={page + 1 >= totalPages || loading} className={secondaryBtnCx}>Next</button>
          </div>
        </div>
      )}

      <p className="mt-4 text-xs text-bt-muted">Viewing and deleting leads is recorded in the audit log.</p>

      <AnimatePresence>
        {toDelete && (
          <DeleteLeadModal key={toDelete.id} lead={toDelete} onClose={() => setToDelete(null)} onDeleted={afterDelete} />
        )}
      </AnimatePresence>
    </>
  );
}

function DeleteLeadModal({
  lead,
  onClose,
  onDeleted,
}: {
  lead: PlatformLead;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [failed, setFailed] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  // The safe choice has the focus: Enter on an opened dialog must not delete.
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  const close = () => {
    if (!deleting) onClose();
  };

  const confirm = async () => {
    setDeleting(true);
    setFailed(false);
    try {
      await deleteLead(lead.id);
      onDeleted();
    } catch {
      setFailed(true);
      setDeleting(false);
    }
  };

  return (
    <PlatformModal title="Delete lead" onClose={close}>
      <div onKeyDown={e => { if (e.key === 'Escape') close(); }}>
        <p className="mt-1.5 text-[13px] leading-normal text-bt-muted">
          This permanently removes the contact below from the leads table. The deletion is recorded in the
          audit log and cannot be undone.
        </p>
        {failed && <div role="alert" className={`${errorBoxCx} mt-3`}>Delete failed.</div>}
        <span className={`${chipCx} mt-3`}>{lead.name} · {lead.company}</span>
        <div className="mt-5 flex justify-end gap-2.5">
          <button ref={cancelRef} type="button" onClick={close} disabled={deleting} className={secondaryBtnCx}>
            Cancel
          </button>
          <button type="button" onClick={confirm} disabled={deleting} className={dangerBtnCx}>
            {deleting ? 'Deleting…' : 'Delete lead'}
          </button>
        </div>
      </div>
    </PlatformModal>
  );
}
