import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import QRCode from 'qrcode';
import { AlertTriangle, KeyRound, Loader2, Mail, RefreshCw, X } from 'lucide-react';
import {
  getWorkerQr, listUserActivity, listUserSessions, regenerateWorkerQr,
  resetPassword, revokeAllSessions, revokeSession, setWorkerPin, updateUser,
  type AuditEntryDTO, type SessionDTO, type UserDTO, type WorkerQrDTO,
} from '../../services/users';
import { fmtDateTime } from '../../helpers/dateTime';
import { Mono, initials, isFieldRole, randomPin } from './shared';

/**
 * User detail drawer. For field roles the credential (QR + PIN) is the first
 * thing shown — it is what the admin came for; office users get their web
 * sign-in facts instead. Sessions and recent activity follow.
 */
export function UserDrawer({ user, onClose, onChanged }: {
  user: UserDTO;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { t, i18n } = useTranslation(['admin', 'common', 'users']);
  const lang = i18n.language;
  const field = isFieldRole(user.role);

  const [qr, setQr] = useState<WorkerQrDTO | null>(null);
  const [sessions, setSessions] = useState<SessionDTO[]>([]);
  const [activity, setActivity] = useState<AuditEntryDTO[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [pinEditing, setPinEditing] = useState(false);
  const [pinValue, setPinValue] = useState('');
  const [pinSaved, setPinSaved] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const loadAll = useCallback(() => {
    if (field) getWorkerQr(user.id).then(setQr).catch(() => setQr(null));
    listUserSessions(user.id).then(setSessions).catch(() => setSessions([]));
    listUserActivity(user.id, 6).then(setActivity).catch(() => setActivity([]));
  }, [user.id, field]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Paint the QR whenever we have a token and the canvas is mounted.
  useEffect(() => {
    if (qr?.qrToken && canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, qr.qrToken, { width: 132, margin: 1 }).catch(() => {});
    }
  }, [qr?.qrToken]);

  async function run(key: string, fn: () => Promise<unknown>, after?: () => void) {
    setBusy(key);
    try { await fn(); after?.(); } catch { /* surfaced by the row state */ } finally { setBusy(null); }
  }

  const savePin = () =>
    run('pin', () => setWorkerPin(user.id, pinValue), () => {
      setPinEditing(false); setPinSaved(true); setPinValue('');
      loadAll(); onChangedSoft();
    });

  // The roster needs to refresh its PIN map, but closing the drawer on every
  // small change would be hostile — so notify without closing.
  const [dirty, setDirty] = useState(false);
  const onChangedSoft = () => setDirty(true);
  const close = () => { if (dirty) onChanged(); else onClose(); };

  const toggleStatus = () =>
    run('status', () => updateUser(user.id, { status: user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' }), onChanged);

  return (
    <div className="fixed inset-0 z-[80]">
      <div onClick={close} className="absolute inset-0 bg-[#0B0A09]/40" />
      <aside className="absolute top-0 right-0 bottom-0 w-[472px] max-w-[92%] bg-white border-l border-[#CDBFA6] shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E4E4E7] flex-shrink-0">
          <Mono className="text-[11px] tracking-[0.15em] text-[#5A5346]">{t('admin:usr.d.title')}</Mono>
          <button onClick={close} className="w-7 h-7 border border-[#E4E4E7] bg-[#FAF7F0] flex items-center justify-center hover:border-[#F97316]">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {/* Identity */}
          <div className="flex gap-4 items-start">
            <span className={`w-14 h-14 flex items-center justify-center font-bt-mono text-[16px] font-semibold flex-shrink-0 ${field ? 'bg-[#0A0A0A] text-[#F5F1E8]' : 'bg-[#EDE5D6] text-[#0A0A0A]'}`}>
              {initials(user.fullName, user.username)}
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-bt-heading font-bold text-xl leading-tight text-[#0A0A0A]">{user.fullName || user.username}</p>
              <Mono className="block text-[12px] normal-case tracking-normal text-[#A69C8D] mt-1">@{user.username}</Mono>
              <div className="flex flex-wrap gap-2 mt-2.5">
                <Mono className="text-[10px] bg-[#F3EEE4] text-[#5A5346] px-2 py-1">{t(`common:roles.${user.role}`)}</Mono>
                <Mono className={`text-[10px] px-2 py-1 ${user.status === 'ACTIVE' ? 'bg-[#E8F0E5] text-[#2E6B34]' : 'bg-[#F4F4F5] text-[#71717A]'}`}>
                  {t(`admin:usr.st.${user.status}`)}
                </Mono>
                {user.hourlyRate != null && (
                  <Mono className="text-[10px] bg-[#F3EEE4] text-[#5A5346] px-2 py-1">${user.hourlyRate}/h</Mono>
                )}
              </div>
            </div>
          </div>

          {/* How they sign in */}
          <div className="flex gap-2.5 items-center bg-[#F7F3EA] border border-[#ECE4D5] px-3 py-2.5 mt-3.5">
            <span className={`w-7 h-7 flex items-center justify-center flex-shrink-0 font-bt-mono text-[11px] ${field ? 'bg-[#F97316] text-[#0A0A0A]' : 'bg-[#0A0A0A] text-[#F5F1E8]'}`}>
              {field ? '⛏' : '⌨'}
            </span>
            <div className="text-[12.5px] text-[#43301F] leading-snug">
              <b className="font-semibold">{t(`admin:usr.access.${field ? 'FIELD' : 'OFFICE'}`)}</b><br />
              <Mono className="text-[10.5px] normal-case tracking-[0.03em] text-[#8A8175]">
                {t(`admin:usr.group.${field ? 'FIELD' : 'OFFICE'}Sub`)}
              </Mono>
            </div>
          </div>

          <button onClick={toggleStatus} disabled={busy === 'status'}
            className="w-full mt-3 border border-[#DBD0BB] bg-[#FAF7F0] px-3 py-2.5 font-bt-mono text-[10.5px] uppercase tracking-[0.06em] font-semibold text-[#0A0A0A] hover:border-[#F97316] hover:text-[#C2410C] disabled:opacity-50">
            {busy === 'status' ? '…' : t(user.status === 'ACTIVE' ? 'admin:usr.d.deactivate' : 'admin:usr.d.activate')}
          </button>

          {/* ACCESS */}
          <div className="flex items-center gap-2.5 mt-6 mb-2.5">
            <span className="w-4 h-px bg-[#F97316] block" />
            <Mono className="text-[10px] tracking-[0.12em] text-[#8A8175]">{t('admin:usr.d.access')}</Mono>
          </div>

          {field ? (
            <div className="border border-[#E4E4E7] bg-white">
              <div className="flex gap-4 p-4 items-center">
                <div className="relative bg-white border border-[#E4E4E7] p-2 flex-shrink-0">
                  {qr ? <canvas ref={canvasRef} /> : <div className="w-[132px] h-[132px] bg-[#F4F4F5] animate-pulse" />}
                </div>
                <div className="flex-1 min-w-0">
                  <Mono className="block text-[10px] text-[#8A8175]">{t('admin:usr.d.credential')}</Mono>
                  <p className="text-[12.5px] text-[#43301F] leading-snug mt-1.5">{t('admin:usr.d.credentialHow')}</p>
                </div>
              </div>
              <div className="border-t border-[#EDE7DB] p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <Mono className="block text-[10px] text-[#8A8175] mb-2">{t('admin:usr.d.pin')}</Mono>
                    {qr?.hasPin || pinSaved ? (
                      <div className="flex gap-1.5">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <span key={i} className="w-7 h-9 border border-[#CDBFA6] bg-[#FAF7F0] flex items-center justify-center font-bt-mono text-lg font-semibold text-[#0A0A0A]">•</span>
                        ))}
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-2 bg-[#FBEDE0] border border-[#F6CFA6] px-2.5 py-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-[#EA580C]" />
                        <Mono className="text-[11px] tracking-[0.05em] text-[#C2410C] font-semibold">{t('admin:usr.d.noPin')}</Mono>
                      </div>
                    )}
                  </div>
                  <button onClick={() => { setPinEditing(v => !v); setPinValue(''); }}
                    className={`font-bt-mono text-[10px] uppercase tracking-[0.06em] font-semibold px-3 py-2 ${
                      qr?.hasPin || pinSaved
                        ? 'border border-[#DBD0BB] bg-[#FAF7F0] text-[#0A0A0A] hover:border-[#F97316] hover:text-[#C2410C]'
                        : 'bg-[#F97316] hover:bg-[#EA580C] text-[#0A0A0A]'
                    }`}>
                    {qr?.hasPin || pinSaved ? t('admin:usr.d.changePin') : t('admin:usr.d.setPin')}
                  </button>
                </div>

                {pinEditing && (
                  <div className="mt-3.5 pt-3.5 border-t border-dashed border-[#DED4C2]">
                    <div className="flex gap-2.5 items-center flex-wrap">
                      <input value={pinValue} onChange={e => setPinValue(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        inputMode="numeric" maxLength={6} placeholder="——————"
                        className="w-[150px] border border-[#CDBFA6] bg-white px-3 py-2 font-bt-mono text-xl tracking-[0.42em] text-center text-[#0A0A0A] outline-none focus:border-[#F97316]" />
                      <button onClick={() => setPinValue(randomPin())}
                        className="border border-[#DBD0BB] bg-[#FAF7F0] px-3 py-2 font-bt-mono text-[10px] uppercase tracking-[0.06em] text-[#5A5346] hover:border-[#F97316] hover:text-[#C2410C]">
                        {t('admin:usr.d.generate')}
                      </button>
                      <button onClick={savePin} disabled={pinValue.length !== 6 || busy === 'pin'}
                        className="bg-[#0A0A0A] hover:bg-[#F97316] text-[#F5F1E8] hover:text-[#0A0A0A] disabled:opacity-40 disabled:hover:bg-[#0A0A0A] disabled:hover:text-[#F5F1E8] px-3.5 py-2 font-bt-mono text-[10px] uppercase tracking-[0.06em] font-semibold">
                        {busy === 'pin' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t('admin:usr.d.savePin')}
                      </button>
                    </div>
                    <Mono className="block text-[9.5px] normal-case tracking-[0.04em] text-[#B4A992] mt-2">{t('admin:usr.d.pinHint')}</Mono>
                  </div>
                )}

                <button onClick={() => run('qr', () => regenerateWorkerQr(user.id).then(setQr), onChangedSoft)}
                  disabled={busy === 'qr'}
                  className="w-full mt-3.5 inline-flex items-center justify-center gap-2 border border-[#DBD0BB] bg-[#FAF7F0] px-3 py-2.5 font-bt-mono text-[10.5px] uppercase tracking-[0.06em] font-semibold text-[#0A0A0A] hover:border-[#F97316] hover:text-[#C2410C] disabled:opacity-50">
                  {busy === 'qr' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  {t('admin:usr.d.regenerate')}
                </button>
              </div>
            </div>
          ) : (
            <div className="border border-[#E4E4E7] bg-white p-4">
              <div className="grid grid-cols-[96px_1fr] gap-3 items-center">
                <Mono className="text-[10px] normal-case tracking-[0.06em] text-[#A69C8D]">{t('admin:usr.d.username')}</Mono>
                <Mono className="text-[13px] normal-case tracking-normal text-[#0A0A0A]">{user.username}</Mono>
                <Mono className="text-[10px] normal-case tracking-[0.06em] text-[#A69C8D]">{t('admin:usr.d.password')}</Mono>
                <Mono className="text-[13px] normal-case tracking-normal text-[#0A0A0A]">
                  •••••••••• <span className="text-[#B4A992] text-[10.5px]">· {t('admin:usr.d.passwordOwn')}</span>
                </Mono>
              </div>
              <button onClick={() => {
                const pwd = window.prompt(t('admin:usr.d.resetPrompt'));
                if (pwd && pwd.length >= 8) run('pw', () => resetPassword(user.id, { newPassword: pwd }));
              }}
                disabled={busy === 'pw'}
                className="w-full mt-4 inline-flex items-center justify-center gap-2 border border-[#DBD0BB] bg-[#FAF7F0] px-3 py-2.5 font-bt-mono text-[10.5px] uppercase tracking-[0.06em] font-semibold text-[#0A0A0A] hover:border-[#F97316] hover:text-[#C2410C] disabled:opacity-50">
                <KeyRound className="w-3.5 h-3.5" />{t('admin:usr.d.resetPassword')}
              </button>
            </div>
          )}

          {/* SESSIONS */}
          <div className="flex items-center justify-between mt-6 mb-2.5">
            <div className="flex items-center gap-2.5">
              <span className="w-4 h-px bg-[#F97316] block" />
              <Mono className="text-[10px] tracking-[0.12em] text-[#8A8175]">{t('admin:usr.d.sessions')}</Mono>
            </div>
            {sessions.some(s => s.status === 'ACTIVE') && (
              <button onClick={() => run('revokeAll', () => revokeAllSessions(user.id), loadAll)}
                className="font-bt-mono text-[10px] uppercase tracking-[0.08em] text-[#C2410C] hover:text-[#F97316] font-semibold">
                {t('admin:usr.d.revokeAll')}
              </button>
            )}
          </div>
          {sessions.length === 0 ? (
            <div className="border border-[#E4E4E7] bg-[#FAF7F0] p-4 text-center">
              <Mono className="text-[11px] normal-case tracking-[0.05em] text-[#A69C8D]">{t('admin:usr.d.noSessions')}</Mono>
            </div>
          ) : (
            <div className="border border-[#E4E4E7]">
              {sessions.slice(0, 5).map(s => (
                <div key={s.id} className="flex items-center gap-3 px-3.5 py-3 border-b border-[#F0EBE1] last:border-b-0">
                  <span className={`w-2 h-2 flex-shrink-0 ${s.status === 'ACTIVE' ? 'bg-[#5FA36A]' : 'bg-[#D4D4D8]'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] text-[#0A0A0A] font-semibold truncate">{s.userAgent || t('admin:usr.d.unknownDevice')}</p>
                    <Mono className="block text-[10px] normal-case tracking-[0.03em] text-[#A69C8D] mt-0.5 truncate">
                      {[s.ipAddress, s.lastUsedAt && fmtDateTime(s.lastUsedAt, lang)].filter(Boolean).join(' · ')}
                    </Mono>
                  </div>
                  {s.status === 'ACTIVE' ? (
                    <button onClick={() => run(`rev-${s.id}`, () => revokeSession(user.id, s.id), loadAll)}
                      disabled={busy === `rev-${s.id}`}
                      className="flex-shrink-0 border border-[#DBD0BB] bg-white px-2.5 py-1.5 font-bt-mono text-[9.5px] uppercase tracking-[0.06em] font-semibold text-[#0A0A0A] hover:border-[#F97316] hover:text-[#C2410C] disabled:opacity-50">
                      {t('admin:usr.d.revoke')}
                    </button>
                  ) : (
                    <Mono className="flex-shrink-0 text-[9.5px] text-[#B4A992]">{t('admin:usr.d.revoked')}</Mono>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ACTIVITY */}
          <div className="flex items-center gap-2.5 mt-6 mb-2.5">
            <span className="w-4 h-px bg-[#F97316] block" />
            <Mono className="text-[10px] tracking-[0.12em] text-[#8A8175]">{t('admin:usr.d.activity')}</Mono>
          </div>
          {activity.length === 0 ? (
            <div className="border border-[#E4E4E7] bg-[#FAF7F0] p-4 text-center">
              <Mono className="text-[11px] normal-case tracking-[0.05em] text-[#A69C8D]">{t('admin:usr.d.noActivity')}</Mono>
            </div>
          ) : (
            <div className="border border-[#E4E4E7]">
              {activity.map(a => (
                <div key={a.id} className="flex items-baseline gap-3 px-3.5 py-2.5 border-b border-[#F0EBE1] last:border-b-0">
                  <Mono className="text-[10.5px] normal-case tracking-normal text-[#A69C8D] w-[74px] flex-shrink-0">
                    {a.createdAt ? fmtDateTime(a.createdAt, lang).split(',').pop()?.trim() : '—'}
                  </Mono>
                  <span className="flex-1 min-w-0 text-[12.5px] leading-snug text-[#2E2A24] truncate">
                    {i18n.exists(`admin:audit.act.${a.action}`)
                      ? t(`admin:audit.act.${a.action}`)
                      : i18n.exists(`admin:dash.act.${a.action}`)
                        ? t(`admin:dash.act.${a.action}`)
                        : a.action.toLowerCase().replace(/_/g, ' ')}
                    {a.entity && <span className="text-[#0A0A0A]"> · {a.entity}</span>}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
