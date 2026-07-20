import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { CircleAlert, CircleCheck, LockKeyhole, RefreshCw } from 'lucide-react';

import { PublicTopbar, TopbarBackLink } from '../components/landing/PublicTopbar';
import { BETA_EMAIL } from '../components/landing/contact';
import { usePublicPageTitle } from '../hooks/usePublicPageTitle';
import { getPaddle, openCheckout } from '../lib/paddle';

const CONTAINER = 'mx-auto max-w-[720px] px-[clamp(22px,5vw,56px)]';

/**
 * Where the page is in the payment conversation. `opening` covers both the
 * initial auto-open (Paddle.js reads `?_ptxn=` at Initialize) and a manual
 * re-open; the overlay itself is Paddle's, layered over this page.
 */
type PayState = 'missing' | 'opening' | 'closed' | 'completed' | 'error';

/**
 * Public target of Paddle's **default payment link** (`/pay?_ptxn=<txn>`).
 *
 * Console-provisioned PADDLE tenants get their checkout URL minted by the
 * backend and emailed / WhatsApp-ed to the customer; Paddle builds that URL
 * as THIS page plus the transaction id. Paddle.js opens its overlay on top —
 * card data never touches BuildTrack, and this page never mutates billing
 * state: activation happens only when Paddle's webhook reaches the backend.
 *
 * Deliberately session-free: the payer typically has no password yet (the
 * set-password invite travels in a separate email).
 */
export function Pay() {
  const { t } = useTranslation('pay');
  usePublicPageTitle(t('meta.title'));

  const [params] = useSearchParams();
  const transactionId = params.get('_ptxn')?.trim() ?? '';

  const [state, setState] = useState<PayState>(transactionId ? 'opening' : 'missing');

  useEffect(() => {
    if (!transactionId) return;
    let cancelled = false;

    getPaddle({
      eventCallback: event => {
        if (cancelled) return;
        switch (event.name) {
          case 'checkout.completed':
            setState('completed');
            break;
          case 'checkout.closed':
            // Fires after completion too (the buyer closing the receipt) and
            // after errors — only downgrade a checkout that was simply open.
            setState(s => (s === 'opening' ? 'closed' : s));
            break;
          case 'checkout.error':
            setState(s => (s === 'completed' ? s : 'error'));
            break;
        }
      },
    }).catch(() => {
      if (!cancelled) setState('error');
    });

    return () => {
      cancelled = true;
    };
  }, [transactionId]);

  const reopen = () => {
    setState('opening');
    openCheckout({ transactionId }).catch(() => setState('error'));
  };

  return (
    <div className="bt-public flex min-h-[100svh] flex-col bg-bt-paper font-bt-body text-base text-bt-ink">
      <PublicTopbar label={t('topbar.label')} containerClass={CONTAINER}>
        <TopbarBackLink to="/">{t('topbar.back')}</TopbarBackLink>
      </PublicTopbar>

      <main className={`${CONTAINER} w-full flex-1 py-[clamp(40px,6vw,72px)]`}>
        {state === 'missing' && (
          <Card
            icon={<CircleAlert size={26} strokeWidth={1.8} className="text-bt-orange" />}
            title={t('missing.title')}
          >
            <p className="text-[15px] leading-relaxed text-bt-muted">{t('missing.body')}</p>
            <ContactLine />
          </Card>
        )}

        {state === 'opening' && (
          <Card
            icon={
              <span
                aria-hidden="true"
                className="block size-6 animate-spin rounded-full border-2 border-bt-ink/25 border-t-bt-ink motion-reduce:animate-none"
              />
            }
            title={t('opening.title')}
          >
            <p className="text-[15px] leading-relaxed text-bt-muted">{t('opening.body')}</p>
            <button type="button" onClick={reopen} className={secondaryBtn}>
              {t('opening.manual')}
            </button>
          </Card>
        )}

        {state === 'closed' && (
          <Card
            icon={<CircleAlert size={26} strokeWidth={1.8} className="text-bt-orange" />}
            title={t('closed.title')}
          >
            <p className="text-[15px] leading-relaxed text-bt-muted">{t('closed.body')}</p>
            <button type="button" onClick={reopen} className={primaryBtn}>
              <RefreshCw size={15} strokeWidth={2} />
              <span>{t('closed.reopen')}</span>
            </button>
          </Card>
        )}

        {state === 'completed' && (
          <Card
            icon={<CircleCheck size={26} strokeWidth={2} className="text-bt-green" />}
            title={t('completed.title')}
          >
            <p className="text-[15px] leading-relaxed text-bt-muted">{t('completed.body')}</p>
            <p className="text-[13.5px] leading-relaxed text-bt-muted-2">{t('completed.note')}</p>
          </Card>
        )}

        {state === 'error' && (
          <Card
            icon={<CircleAlert size={26} strokeWidth={1.8} className="text-bt-red" />}
            title={t('error.title')}
          >
            <p className="text-[15px] leading-relaxed text-bt-muted">{t('error.body')}</p>
            <button type="button" onClick={reopen} className={secondaryBtn}>
              <RefreshCw size={15} strokeWidth={2} />
              <span>{t('error.retry')}</span>
            </button>
            <ContactLine />
          </Card>
        )}

        <p className="mt-7 flex items-start justify-center gap-2 text-center text-[12.5px] leading-normal text-bt-muted-2">
          <LockKeyhole size={13} strokeWidth={1.8} className="mt-0.5 flex-none" />
          <span>{t('secure.note')}</span>
        </p>
      </main>
    </div>
  );
}

// ── Building blocks ─────────────────────────────────────────────

const primaryBtn =
  'inline-flex h-11 cursor-pointer items-center justify-center gap-2 self-start rounded-lg border border-bt-orange-hover bg-bt-orange px-5 text-[14.5px] font-bold text-bt-ink shadow-[0_1px_2px_rgba(23,19,15,0.18)] transition-colors hover:bg-bt-orange-hover';

const secondaryBtn =
  'inline-flex h-10 cursor-pointer items-center justify-center gap-2 self-start rounded-lg border border-bt-rule bg-white px-4 text-[13.5px] font-semibold text-bt-ink transition-colors hover:bg-bt-paper-2';

function Card({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-live="polite"
      className="flex flex-col gap-4 rounded-[14px] border border-bt-rule bg-white px-[clamp(24px,4vw,40px)] py-[clamp(28px,4vw,40px)] shadow-[0_1px_3px_rgba(23,19,15,0.06)]"
    >
      <span className="flex size-12 items-center justify-center rounded-full border border-bt-rule bg-bt-paper">
        {icon}
      </span>
      <h1 className="font-bt-heading text-[clamp(20px,3vw,24px)] font-bold leading-tight text-bt-ink">
        {title}
      </h1>
      {children}
    </section>
  );
}

/** "If it keeps failing, write to us" — same address the whole site uses. */
function ContactLine() {
  const { t } = useTranslation('pay');
  return (
    <p className="text-[13.5px] leading-relaxed text-bt-muted-2">
      {t('contact.lead')}{' '}
      <a
        href={`mailto:${BETA_EMAIL}`}
        className="font-semibold text-bt-orange transition-colors hover:text-bt-orange-hover"
      >
        {BETA_EMAIL}
      </a>
    </p>
  );
}
