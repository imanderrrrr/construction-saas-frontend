import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ChevronRight } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

import { CreateTenantForm } from '../components/CreateTenantForm';
import { TenantCreatedCard } from '../components/TenantCreatedCard';
import type { CreateTenantResponse } from '../types';
import { EASE_OUT, pageTitleCx } from '../components/console';

/**
 * The "Create new tenant" screen (was a modal; the approved design makes it
 * a dedicated page under /platform/tenants/new). The form itself — rules,
 * payload, service call — lives in CreateTenantForm; this page owns the
 * breadcrumb, the header and the post-create success state
 * (TenantCreatedCard).
 */
export function PlatformTenantCreate() {
  const navigate = useNavigate();
  const [created, setCreated] = useState<CreateTenantResponse | null>(null);
  // Re-mounts a pristine form for "Create another".
  const [formKey, setFormKey] = useState(0);

  const backToTenants = () => {
    // Hand the result to the list so it can show its confirmation banner.
    navigate('/platform/tenants', created ? { state: { created } } : undefined);
  };

  return (
    <>
      <nav className="flex items-center gap-1.5 text-[12.5px] font-medium">
        <Link to="/platform/tenants" className="font-semibold text-bt-orange transition-colors hover:text-bt-orange-hover">
          Tenants
        </Link>
        <ChevronRight size={12} strokeWidth={2} className="text-bt-muted-2" />
        <span className="font-semibold text-bt-ink">New tenant</span>
      </nav>

      <AnimatePresence mode="wait" initial={false}>
        {!created ? (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={{ duration: 0.28, ease: EASE_OUT }}
          >
            <header className="mt-4">
              <h1 className={pageTitleCx}>Create new tenant</h1>
              <p className="mt-2.5 max-w-[62ch] text-sm leading-relaxed text-bt-muted">
                Creates the workspace, its admin, and its billing — automatic Paddle card billing
                at the negotiated price, or a manually-billed plan. The admin gets an email to
                choose their own password — you never see it.
              </p>
              <p className="mt-1.5 text-[12.5px] text-bt-muted-2">All fields are required.</p>
            </header>

            <CreateTenantForm key={formKey} onCreated={setCreated} onCancel={backToTenants} />
          </motion.div>
        ) : (
          <motion.div
            key="success"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={{ duration: 0.3, ease: EASE_OUT }}
            className="mx-auto mt-14 max-w-[600px]"
          >
            <TenantCreatedCard
              created={created}
              onCreateAnother={() => {
                setCreated(null);
                setFormKey(k => k + 1);
              }}
              onBack={backToTenants}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
