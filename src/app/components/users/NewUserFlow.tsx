import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import QRCode from 'qrcode';
import { ChevronLeft, ChevronRight, Check, Loader2, RefreshCw, X } from 'lucide-react';
import { createUser, getWorkerQr, setWorkerPin, type UserDTO } from '../../services/users';
import { GRID_INK, Mono, isFieldRole, randomPassword, randomPin } from './shared';

/**
 * Guided user creation. Three steps — identity+role, access, credential — and
 * it deliberately ends on the credential the admin has to hand over, because
 * "created the user" is not the job; "the worker can get in" is.
 *
 * The role picked in step 1 decides the whole second step: field roles set a
 * PIN (and get a QR), office roles get a temporary password.
 */

const ROLES = ['ADMIN', 'FINANCE', 'WAREHOUSE', 'SUPERVISOR', 'WORKER', 'SUBCONTRACTOR'] as const;

export function NewUserFlow({ existingUsernames, onClose, onCreated }: {
  existingUsernames: string[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const { t } = useTranslation(['admin', 'common']);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [touchedUsername, setTouchedUsername] = useState(false);
  const [role, setRole] = useState<string>('WORKER');
  const [hourlyRate, setHourlyRate] = useState('');
  const [pin, setPin] = useState('');
  const [password, setPassword] = useState(randomPassword());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<UserDTO | null>(null);
  const [qrToken, setQrToken] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const field = isFieldRole(role);

  // Derive the username from the full name until the admin edits it.
  useEffect(() => {
    if (touchedUsername) return;
    const slug = fullName.trim().toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9\s.]/g, '').trim().replace(/\s+/g, '.');
    setUsername(slug);
  }, [fullName, touchedUsername]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && step !== 3) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, step]);

  useEffect(() => {
    if (step === 3 && qrToken && canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, qrToken, { width: 168, margin: 1 }).catch(() => {});
    }
  }, [step, qrToken]);

  const usernameTaken = existingUsernames.includes(username.trim());
  const step1Ok = fullName.trim().length > 1 && username.trim().length > 2 && !usernameTaken;
  const step2Ok = field ? pin.length === 6 : password.length >= 8;

  async function submit() {
    setSaving(true); setError(null);
    try {
      const user = await createUser({
        username: username.trim(),
        password: field ? randomPassword() : password, // field users never use it
        fullName: fullName.trim() || null,
        role: role as UserDTO['role'],
        hourlyRate: hourlyRate ? Number(hourlyRate) : null,
      });
      setCreated(user);
      if (field) {
        await setWorkerPin(user.id, pin);
        const qr = await getWorkerQr(user.id);
        setQrToken(qr.qrToken);
      }
      onCreated();
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('admin:usr.new.error'));
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setStep(1); setFullName(''); setUsername(''); setTouchedUsername(false);
    setRole('WORKER'); setHourlyRate(''); setPin(''); setPassword(randomPassword());
    setCreated(null); setQrToken(null); setError(null);
  }

  const steps = [
    { n: 1, label: t('admin:usr.new.s1') },
    { n: 2, label: t('admin:usr.new.s2') },
    { n: 3, label: t('admin:usr.new.s3') },
  ];

  return (
    <div className="fixed inset-0 z-[90] bg-[#FAFAFA] flex flex-col">
      {/* Ink bar */}
      <div className="relative overflow-hidden bg-[#0A0A0A] text-[#F5F1E8] px-6 py-4 flex-shrink-0">
        <div className="absolute inset-0 pointer-events-none" style={GRID_INK} />
        <div className="relative flex items-center justify-between gap-4 flex-wrap">
          <div>
            <Mono className="block text-[10.5px] tracking-[0.15em] text-[#F97316]">{t('admin:usr.new.kicker')}</Mono>
            <p className="font-bt-display font-bold text-3xl leading-none mt-1">
              {step === 3 ? t('admin:usr.new.headlineDone') : t('admin:usr.new.headline')}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-3.5">
              {steps.map(s => (
                <div key={s.n} className="flex items-center gap-2">
                  <span className={`w-5 h-5 flex items-center justify-center font-bt-mono text-[10px] font-semibold ${
                    step === s.n ? 'bg-[#F97316] text-[#0A0A0A]' : step > s.n ? 'bg-[#F5F1E8]/20 text-[#F5F1E8]' : 'border border-[#F5F1E8]/25 text-[#F5F1E8]/50'
                  }`}>
                    {step > s.n ? '✓' : s.n}
                  </span>
                  <Mono className={`text-[10px] ${step === s.n ? 'text-[#F5F1E8]' : 'text-[#F5F1E8]/50'}`}>{s.label}</Mono>
                </div>
              ))}
            </div>
            <button onClick={step === 3 ? () => { onClose(); } : onClose}
              className="w-8 h-8 border border-[#F5F1E8]/25 flex items-center justify-center hover:border-[#F97316] hover:text-[#F97316]">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-[760px] mx-auto">
          {/* STEP 1 — identity + role */}
          {step === 1 && (
            <div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Mono className="block text-[10px] text-[#5A5346] mb-2">{t('admin:usr.new.fullName')}</Mono>
                  <input value={fullName} onChange={e => setFullName(e.target.value)} autoFocus
                    placeholder={t('admin:usr.new.fullNamePh')}
                    className="w-full border border-[#DBD0BB] bg-white px-3.5 py-3 text-sm text-[#0A0A0A] outline-none focus:border-[#F97316]" />
                </div>
                <div>
                  <Mono className="block text-[10px] text-[#5A5346] mb-2">{t('admin:usr.new.username')}</Mono>
                  <input value={username}
                    onChange={e => { setTouchedUsername(true); setUsername(e.target.value.toLowerCase().replace(/\s+/g, '.')); }}
                    placeholder="marta.lopez"
                    className={`w-full border bg-white px-3.5 py-3 font-bt-mono text-[13.5px] text-[#0A0A0A] outline-none ${usernameTaken ? 'border-[#EA580C]' : 'border-[#DBD0BB] focus:border-[#F97316]'}`} />
                  {usernameTaken && (
                    <Mono className="block text-[10px] normal-case text-[#EA580C] mt-1.5">{t('admin:usr.new.usernameTaken')}</Mono>
                  )}
                </div>
              </div>

              <Mono className="block text-[10px] text-[#5A5346] mt-6 mb-2.5">{t('admin:usr.new.roleLabel')}</Mono>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {ROLES.map(r => {
                  const rField = isFieldRole(r);
                  const active = role === r;
                  return (
                    <button key={r} onClick={() => setRole(r)}
                      className={`text-left border p-3 transition-colors ${active ? 'border-[#F97316] bg-[#FBEDE0]' : 'border-[#DBD0BB] bg-white hover:border-[#F97316]'}`}>
                      <div className="flex items-center justify-between">
                        <Mono className="text-[12px] tracking-[0.05em] font-semibold text-[#0A0A0A]">{t(`common:roles.${r}`)}</Mono>
                        <span className={`w-2.5 h-2.5 ${active ? 'bg-[#F97316]' : 'bg-[#E4E4E7]'}`} />
                      </div>
                      <Mono className={`block text-[9px] tracking-[0.08em] mt-2 ${rField ? 'text-[#C2410C]' : 'text-[#8A8175]'}`}>
                        {t(`admin:usr.access.${rField ? 'FIELD' : 'OFFICE'}`)}
                      </Mono>
                    </button>
                  );
                })}
              </div>

              {field && (
                <div className="mt-4 max-w-[260px]">
                  <Mono className="block text-[10px] text-[#5A5346] mb-2">{t('admin:usr.new.rate')}</Mono>
                  <div className="flex items-center border border-[#DBD0BB] bg-white">
                    <span className="pl-3.5 pr-1 font-bt-mono text-sm text-[#8A8175]">$</span>
                    <input value={hourlyRate} onChange={e => setHourlyRate(e.target.value.replace(/[^\d.]/g, ''))}
                      inputMode="decimal" placeholder="4.25"
                      className="flex-1 w-full border-0 bg-transparent px-1 py-3 font-bt-mono text-sm text-[#0A0A0A] outline-none" />
                    <span className="pr-3.5 pl-1 font-bt-mono text-xs text-[#8A8175]">/H</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2 — access */}
          {step === 2 && (
            <div className="max-w-[520px]">
              {field ? (
                <>
                  <p className="font-bt-heading font-bold text-lg text-[#0A0A0A]">
                    {t('admin:usr.new.pinTitle', { name: fullName.split(/\s+/)[0] || username })}
                  </p>
                  <p className="text-[13.5px] text-[#5A5346] leading-relaxed mt-1.5">{t('admin:usr.new.pinBody')}</p>
                  <div className="flex gap-3 items-center mt-5 flex-wrap">
                    <input value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      inputMode="numeric" maxLength={6} placeholder="——————" autoFocus
                      className="w-[210px] border border-[#CDBFA6] bg-white px-4 py-3.5 font-bt-mono text-[28px] tracking-[0.4em] text-center text-[#0A0A0A] outline-none focus:border-[#F97316]" />
                    <button onClick={() => setPin(randomPin())}
                      className="inline-flex items-center gap-2 border border-[#DBD0BB] bg-[#FAF7F0] px-4 py-3 font-bt-mono text-[11px] uppercase tracking-[0.06em] font-semibold text-[#0A0A0A] hover:border-[#F97316] hover:text-[#C2410C]">
                      <RefreshCw className="w-3.5 h-3.5" />{t('admin:usr.d.generate')}
                    </button>
                  </div>
                  <Mono className="block text-[10px] normal-case tracking-[0.05em] text-[#B4A992] mt-2.5">{t('admin:usr.new.pinHint')}</Mono>
                </>
              ) : (
                <>
                  <p className="font-bt-heading font-bold text-lg text-[#0A0A0A]">
                    {t('admin:usr.new.webTitle', { name: fullName.split(/\s+/)[0] || username })}
                  </p>
                  <p className="text-[13.5px] text-[#5A5346] leading-relaxed mt-1.5">{t('admin:usr.new.webBody')}</p>
                  <div className="mt-5 border border-[#E4E4E7] bg-white p-4">
                    <div className="grid grid-cols-[130px_1fr] gap-3 items-center">
                      <Mono className="text-[10px] normal-case tracking-[0.06em] text-[#A69C8D]">{t('admin:usr.d.username')}</Mono>
                      <Mono className="text-sm normal-case tracking-normal text-[#0A0A0A]">{username}</Mono>
                      <Mono className="text-[10px] normal-case tracking-[0.06em] text-[#A69C8D]">{t('admin:usr.new.tempPassword')}</Mono>
                      <span className="flex items-center gap-2.5">
                        <Mono className="text-base font-semibold normal-case tracking-[0.04em] text-[#0A0A0A]">{password}</Mono>
                        <button onClick={() => setPassword(randomPassword())}
                          className="border border-[#DBD0BB] bg-[#FAF7F0] px-2 py-1 font-bt-mono text-[9px] uppercase tracking-[0.06em] text-[#5A5346] hover:border-[#F97316] hover:text-[#C2410C]">
                          {t('admin:usr.new.regenerate')}
                        </button>
                      </span>
                    </div>
                  </div>
                </>
              )}
              {error && (
                <div className="mt-4 bg-[#FBEDE0] border border-[#F6CFA6] border-l-[3px] border-l-[#F97316] px-3 py-2.5">
                  <span className="text-[12.5px] text-[#43301F]">{error}</span>
                </div>
              )}
            </div>
          )}

          {/* STEP 3 — credential ready */}
          {step === 3 && created && (
            <div className="text-center">
              <div className="inline-flex items-center gap-2 font-bt-mono text-[11px] uppercase tracking-[0.12em] text-[#2E6B34] bg-[#E8F0E5] border border-[#CBE0C4] px-3 py-1.5">
                <Check className="w-3.5 h-3.5" />{t('admin:usr.new.createdTag')}
              </div>
              <p className="font-bt-display font-bold text-4xl leading-none text-[#0A0A0A] mt-4 mb-1">
                {t('admin:usr.new.readyBig')}
              </p>
              <p className="text-sm text-[#5A5346]">
                {t('admin:usr.new.readySub', { name: created.fullName || created.username })}
              </p>

              <div className="inline-flex flex-wrap justify-center mt-6 border border-[#CDBFA6] bg-white shadow-lg">
                {field && (
                  <div className="relative p-6 border-r border-[#EDE7DB] bg-white">
                    {qrToken ? <canvas ref={canvasRef} /> : <div className="w-[168px] h-[168px] bg-[#F4F4F5] animate-pulse" />}
                    <Mono className="absolute bottom-3 right-4 text-[8px] tracking-[0.12em] text-[#B4A992]">BUILDTRACK</Mono>
                  </div>
                )}
                <div className="p-6 text-left flex flex-col justify-center min-w-[260px]">
                  <p className="font-bt-heading font-bold text-xl text-[#0A0A0A]">{created.fullName || created.username}</p>
                  <Mono className="block text-[11px] normal-case tracking-normal text-[#A69C8D] mt-1">
                    @{created.username} · {t(`common:roles.${created.role}`)}
                  </Mono>
                  {field ? (
                    <>
                      <Mono className="block text-[10px] text-[#8A8175] mt-5 mb-2">{t('admin:usr.d.pin')}</Mono>
                      <div className="flex gap-1.5">
                        {pin.split('').map((d, i) => (
                          <span key={i} className="w-8 h-10 border border-[#CDBFA6] bg-[#FAF7F0] flex items-center justify-center font-bt-mono text-xl font-semibold text-[#0A0A0A]">{d}</span>
                        ))}
                      </div>
                      <Mono className="block text-[10px] normal-case tracking-[0.05em] text-[#8A8175] mt-4 leading-relaxed">
                        {t('admin:usr.new.howToUse')}
                      </Mono>
                    </>
                  ) : (
                    <div className="grid grid-cols-[130px_1fr] gap-2.5 items-center mt-5">
                      <Mono className="text-[10px] normal-case tracking-[0.06em] text-[#A69C8D]">{t('admin:usr.d.username')}</Mono>
                      <Mono className="text-sm normal-case tracking-normal text-[#0A0A0A]">{created.username}</Mono>
                      <Mono className="text-[10px] normal-case tracking-[0.06em] text-[#A69C8D]">{t('admin:usr.new.tempPassword')}</Mono>
                      <Mono className="text-base font-semibold normal-case tracking-[0.04em] text-[#0A0A0A]">{password}</Mono>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2.5 justify-center mt-6 flex-wrap">
                <button onClick={() => window.print()}
                  className="border border-[#DBD0BB] bg-white px-4 py-2.5 font-bt-mono text-[10.5px] uppercase tracking-[0.06em] font-semibold text-[#0A0A0A] hover:border-[#F97316] hover:text-[#C2410C]">
                  {t('admin:usr.new.print')}
                </button>
                <button onClick={reset}
                  className="border border-[#DBD0BB] bg-white px-4 py-2.5 font-bt-mono text-[10.5px] uppercase tracking-[0.06em] font-semibold text-[#0A0A0A] hover:border-[#F97316] hover:text-[#C2410C]">
                  {t('admin:usr.new.another')}
                </button>
                <button onClick={onClose}
                  className="bg-[#0A0A0A] hover:bg-[#F97316] text-[#F5F1E8] hover:text-[#0A0A0A] px-5 py-2.5 font-bt-mono text-[10.5px] uppercase tracking-[0.08em] font-semibold transition-colors">
                  {t('admin:usr.new.done')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer nav */}
      {step !== 3 && (
        <div className="border-t border-[#E4E4E7] bg-white px-6 py-4 flex items-center justify-between gap-4 flex-shrink-0">
          <button onClick={() => (step === 1 ? onClose() : setStep(1))}
            className="inline-flex items-center gap-1.5 font-bt-mono text-[10.5px] uppercase tracking-[0.06em] font-semibold text-[#8A8175] hover:text-[#C2410C]">
            <ChevronLeft className="w-3.5 h-3.5" />{step === 1 ? t('common:buttons.cancel') : t('admin:usr.new.back')}
          </button>
          <Mono className="hidden sm:block text-[10px] normal-case tracking-[0.08em] text-[#B4A992]">
            {step === 1 ? t('admin:usr.new.hint1') : field ? t('admin:usr.new.hint2Field') : t('admin:usr.new.hint2Office')}
          </Mono>
          <button
            onClick={() => (step === 1 ? setStep(2) : submit())}
            disabled={saving || (step === 1 ? !step1Ok : !step2Ok)}
            className="inline-flex items-center gap-1.5 bg-[#0A0A0A] hover:bg-[#F97316] text-[#F5F1E8] hover:text-[#0A0A0A] disabled:opacity-40 disabled:hover:bg-[#0A0A0A] disabled:hover:text-[#F5F1E8] px-5 py-2.5 font-bt-mono text-[10.5px] uppercase tracking-[0.08em] font-semibold transition-colors">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            {step === 1 ? t('admin:usr.new.next') : t('admin:usr.new.create')}
            {!saving && <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        </div>
      )}
    </div>
  );
}
