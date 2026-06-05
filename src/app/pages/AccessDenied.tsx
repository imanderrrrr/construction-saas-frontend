import { useNavigate } from 'react-router';
import { AuthService } from '../services/auth';
import { Button } from '../components/ui/button';
import {
  Building2,
  ShieldX,
  LogOut,
  Mail,
  ChevronLeft,
} from 'lucide-react';

// Role badge config

type Role = 'SUPERVISOR' | 'WORKER' | 'FINANCE' | 'WAREHOUSE';

const ROLE_CONFIG: Record<Role, { bg: string; text: string; border: string }> = {
  SUPERVISOR: {
    bg: 'bg-blue-50',
    text: 'text-[#F97316]',
    border: 'border-[#F97316]/20',
  },
  WORKER: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
  },
  FINANCE: {
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
  },
  WAREHOUSE: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
  },
};

function RoleBadge({ role }: { role: Role }) {
  const cfg = ROLE_CONFIG[role] ?? {
    bg: 'bg-[#FAFAFA]',
    text: 'text-[#71717A]',
    border: 'border-[#D4D4D8]',
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold font-mono border ${cfg.bg} ${cfg.text} ${cfg.border}`}
    >
      {role}
    </span>
  );
}

// Access Denied Page

export function AccessDenied() {
  const navigate = useNavigate();

  // Use real auth data
  const displayUsername = AuthService.getUsername() ?? 'unknown';
  const displayRole = (AuthService.getRole() ?? 'WORKER') as Role;

  const handleBackToLogin = () => {
    document.cookie = 'ofjr_session=; Path=/; Max-Age=0';
    navigate('/');
    AuthService.logout(); // fire-and-forget server revocation
  };

  const handleContactSupport = () => {
    // UI-only: in production, open mailto or support link
    window.open('mailto:support@ofjrconstruction.com', '_blank');
  };

  // The actual card (shared between desktop and mobile)
  function Card({ compact = false }: { compact?: boolean }) {
    return (
      <div
        className={`bg-white rounded-2xl shadow-xl border border-[#D4D4D8]/50 flex flex-col items-center text-center ${
          compact ? 'px-6 py-8' : 'px-10 py-12'
        }`}
      >
        {/* Shield icon */}
        <div className="relative mb-6">
          <div
            className={`bg-red-50 rounded-2xl flex items-center justify-center ${
              compact ? 'w-16 h-16' : 'w-20 h-20'
            }`}
          >
            <ShieldX
              className={`text-red-500 ${compact ? 'w-8 h-8' : 'w-10 h-10'}`}
            />
          </div>
          {/* Decorative ring */}
          <div className="absolute inset-0 rounded-2xl ring-4 ring-red-100 ring-offset-2 pointer-events-none" />
        </div>

        {/* Heading */}
        <h1
          className={`font-bold text-[#0A0A0A] mb-3 ${
            compact ? 'text-2xl' : 'text-3xl'
          }`}
        >
          Access denied
        </h1>
        <p
          className={`text-[#71717A] leading-relaxed max-w-sm ${
            compact ? 'text-sm' : 'text-base'
          }`}
        >
          You don't have permission to access the admin panel. This area is restricted to
          administrators only.
        </p>

        {/* User Info Section */}
        <div
          className={`w-full mt-6 rounded-xl border border-[#D4D4D8] bg-[#FAFAFA] ${
            compact ? 'p-4' : 'p-5'
          }`}
        >
          <p className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wide mb-3 text-left">
            Current session
          </p>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#71717A]">Signed in as</span>
              <span className="text-sm font-semibold font-mono text-[#0A0A0A]">
                {displayUsername}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#71717A]">Role</span>
              <RoleBadge role={displayRole} />
            </div>
            <div className="h-px bg-[#D4D4D8]" />
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#71717A]">Required role</span>
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold font-mono bg-[#F97316]/10 text-[#F97316] border border-[#F97316]/20">
                ADMIN
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className={`w-full flex flex-col gap-3 mt-6`}>
          {/* Primary — Back to login */}
          <Button
            onClick={handleBackToLogin}
            className="w-full h-11 bg-[#F97316] hover:bg-[#C2410C] text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316] focus-visible:ring-offset-2 gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to login
          </Button>

          {/* Secondary — Contact support */}
          <Button
            variant="outline"
            onClick={handleContactSupport}
            className="w-full h-11 border-[#D4D4D8] text-[#0A0A0A] hover:border-[#F97316] hover:text-[#F97316] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316] focus-visible:ring-offset-2 gap-2"
          >
            <Mail className="w-4 h-4" />
            Contact support
          </Button>

          {/* Tertiary — Sign out silently */}
          <button
            type="button"
            onClick={handleBackToLogin}
            className="flex items-center justify-center gap-1.5 text-xs text-[#71717A] hover:text-red-600 transition-colors mt-1 focus:outline-none focus-visible:underline"
          >
            <LogOut className="w-3 h-3" />
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FAFAFA] to-[#D4D4D8] flex flex-col items-center justify-start py-8 px-4">
      <div className="w-full max-w-2xl flex flex-col items-center">
        {/* Brand header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#F97316] rounded-xl mb-4 shadow-lg shadow-[#F97316]/25">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-[#0A0A0A] mb-1">BuildTrack</h2>
          <p className="text-[#71717A]">Admin Portal</p>
        </div>

        <div className="w-full max-w-md">
          <Card compact={false} />
        </div>

        <p className="text-center text-sm text-[#71717A] mt-6">
          © 2026 BuildTrack. All rights reserved.
        </p>
      </div>
    </div>
  );
}
