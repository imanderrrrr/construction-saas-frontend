// Landing page for users with the SUBCONTRACTOR role.
// The web admin panel does not include a subcontractor workspace —
// subcontractors interact with the company through the OFJR mobile app.
// This page replaces the previous infinite redirect / blank screen with a
// clear explanation and a sign-out button.

import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { AuthService } from '../services/auth';
import { Button } from '../components/ui/button';
import {
  Building2,
  Smartphone,
  LogOut,
  Mail,
} from 'lucide-react';

export function SubcontractorWebInfo() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();

  const displayUsername = AuthService.getUsername() ?? '—';

  const handleSignOut = () => {
    document.cookie = 'ofjr_session=; Path=/; Max-Age=0';
    navigate('/');
    AuthService.logout(); // fire-and-forget server revocation
  };

  const handleContactAdmin = () => {
    window.open('mailto:support@ofjrconstruction.com', '_blank');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FAFAFA] to-[#D4D4D8] flex flex-col items-center justify-start py-8 px-4">
      <div className="w-full max-w-2xl flex flex-col items-center">
        {/* Brand header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#F97316] rounded-xl mb-4 shadow-lg shadow-[#F97316]/25">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-[#0A0A0A] mb-1">BuildTrack</h2>
          <p className="text-[#71717A]">{t('subWebInfo.brandSubtitle', 'Admin Portal')}</p>
        </div>

        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl border border-[#D4D4D8]/50 flex flex-col items-center text-center px-10 py-12">
            {/* Phone icon */}
            <div className="relative mb-6">
              <div className="bg-[#F97316]/10 rounded-2xl flex items-center justify-center w-20 h-20">
                <Smartphone className="text-[#F97316] w-10 h-10" />
              </div>
              <div className="absolute inset-0 rounded-2xl ring-4 ring-[#F97316]/10 ring-offset-2 pointer-events-none" />
            </div>

            <h1 className="text-3xl font-bold text-[#0A0A0A] mb-3">
              {t('subWebInfo.title', 'Este panel no es para tu rol')}
            </h1>
            <p className="text-[#71717A] leading-relaxed max-w-sm">
              {t(
                'subWebInfo.body',
                'Como subcontratista, no usas el panel web. Tienes acceso a la aplicación móvil de BuildTrack para ver tus trabajos, subir evidencia y enviar facturas.',
              )}
            </p>

            {/* Session info */}
            <div className="w-full mt-6 rounded-xl border border-[#D4D4D8] bg-[#FAFAFA] p-5">
              <p className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wide mb-3 text-left">
                {t('subWebInfo.currentSession', 'Sesión actual')}
              </p>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#71717A]">{t('subWebInfo.signedInAs', 'Sesión iniciada como')}</span>
                  <span className="text-sm font-semibold font-mono text-[#0A0A0A]">
                    {displayUsername}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#71717A]">{t('subWebInfo.role', 'Rol')}</span>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold font-mono bg-[#F97316]/10 text-[#F97316] border border-[#F97316]/20">
                    SUBCONTRACTOR
                  </span>
                </div>
              </div>
            </div>

            {/* "Get the app" hint */}
            <div className="w-full mt-4 rounded-xl border border-[#F97316]/20 bg-[#F97316]/5 p-4 text-left">
              <p className="text-xs text-[#0A0A0A] leading-relaxed">
                <strong className="text-[#F97316]">
                  {t('subWebInfo.appHintTitle', '¿Necesitas la app?')}
                </strong>{' '}
                {t(
                  'subWebInfo.appHintBody',
                  'Contacta a un administrador para recibir el enlace de descarga y tus credenciales de acceso.',
                )}
              </p>
            </div>

            {/* Action buttons */}
            <div className="w-full flex flex-col gap-3 mt-6">
              <Button
                onClick={handleContactAdmin}
                className="w-full h-11 bg-[#F97316] hover:bg-[#C2410C] text-white transition-colors gap-2"
              >
                <Mail className="w-4 h-4" />
                {t('subWebInfo.contactAdmin', 'Contactar administrador')}
              </Button>

              <button
                type="button"
                onClick={handleSignOut}
                className="flex items-center justify-center gap-1.5 text-xs text-[#71717A] hover:text-red-600 transition-colors mt-1"
              >
                <LogOut className="w-3 h-3" />
                {t('subWebInfo.signOut', 'Cerrar sesión')}
              </button>
            </div>
          </div>
        </div>

        <p className="text-center text-sm text-[#71717A] mt-6">
          © 2026 BuildTrack. {t('subWebInfo.rightsReserved', 'Todos los derechos reservados.')}
        </p>
      </div>
    </div>
  );
}
