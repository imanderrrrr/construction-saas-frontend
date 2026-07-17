import type { ReactNode } from 'react';
import { motion } from 'motion/react';

import { EASE_OUT } from './console';

/**
 * The console's one dialog chrome. Lifted out of PlatformTenantDetail when
 * the tenant-creation form needed the same shell — two copies of a backdrop
 * that swallows its own clicks is exactly the kind of thing that drifts.
 *
 * Animated per the design language: backdrop fades, card fades + scales
 * 0.98→1. Wrap the conditional render in <AnimatePresence> at the call site
 * to get the exit half; MotionConfig reducedMotion="user" (set in the shell)
 * collapses the scale/slide to a plain fade for reduced-motion users.
 */
export function PlatformModal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-bt-ink/45 px-4"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <motion.div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-bt-rule bg-white p-6 shadow-[0_16px_48px_rgba(23,19,15,0.3)]"
        onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.98, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.985, y: 4 }}
        transition={{ duration: 0.22, ease: EASE_OUT }}
      >
        <h2 className="font-bt-heading text-[15px] font-bold text-bt-ink">{title}</h2>
        {children}
      </motion.div>
    </motion.div>
  );
}
