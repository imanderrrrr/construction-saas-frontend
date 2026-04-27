import { Link } from 'react-router';

export function Support() {
  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-[#0A0A0A]">BuildTrack</h1>
          <Link to="/support" className="text-sm text-[#F97316] hover:underline">
            &larr; Back to top
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-6 py-10">
        {/* Language toggle */}
        <div className="flex justify-end mb-4 gap-2">
          <a href="#es" className="text-sm text-[#F97316] hover:underline">Espa&ntilde;ol</a>
          <span className="text-sm text-[#71717A]">|</span>
          <a href="#en" className="text-sm text-[#F97316] hover:underline">English</a>
        </div>

        {/* ==================== SPANISH VERSION ==================== */}
        <article id="es" className="bg-white rounded-xl border border-gray-200 p-8 space-y-6 text-sm text-[#3D4752] leading-relaxed mb-8">
          <div>
            <h2 className="text-2xl font-bold text-[#0A0A0A] mb-1">Centro de Soporte</h2>
            <p className="text-xs text-[#71717A]">Abril 2026 &mdash; v1.0</p>
          </div>

          {/* Contact info */}
          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">1. Informaci&oacute;n de contacto</h3>
            <p>Si necesitas ayuda con la aplicaci&oacute;n <em>OFJR Construction</em>, puedes comunicarte con nosotros:</p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li><strong>Empresa:</strong> OFJR Construction LLC</li>
              <li><strong>Direcci&oacute;n:</strong> 5601 Hicks Ln, Oklahoma City, Oklahoma 73129, USA</li>
              <li><strong>Correo general:</strong>{' '}
                <a href="mailto:gerson@ofjrconstruction.com" className="text-[#F97316] hover:underline">gerson@ofjrconstruction.com</a>
              </li>
              <li><strong>Correo de soporte:</strong>{' '}
                <a href="mailto:support@ofjrconstruction.com" className="text-[#F97316] hover:underline">support@ofjrconstruction.com</a>
              </li>
            </ul>
          </section>

          {/* How to get help */}
          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">2. C&oacute;mo solicitar ayuda</h3>
            <p>Para reportar un problema o solicitar asistencia:</p>
            <ol className="list-decimal pl-5 space-y-2 mt-2">
              <li>Env&iacute;a un correo a{' '}
                <a href="mailto:support@ofjrconstruction.com" className="text-[#F97316] hover:underline">support@ofjrconstruction.com</a>
              </li>
              <li>Incluye en el <strong>asunto</strong> una breve descripci&oacute;n del problema (ejemplo: &quot;No puedo registrar entrada&quot;)</li>
              <li>En el cuerpo del correo, incluye:
                <ul className="list-disc pl-5 space-y-1 mt-1">
                  <li>Tu <strong>nombre de usuario</strong></li>
                  <li>Tu <strong>dispositivo y sistema operativo</strong> (ejemplo: iPhone 15, iOS 17.4)</li>
                  <li>Una <strong>descripci&oacute;n detallada</strong> del problema</li>
                  <li>Capturas de pantalla si es posible</li>
                </ul>
              </li>
              <li>Nuestro equipo responder&aacute; en un plazo de <strong>2 d&iacute;as h&aacute;biles</strong></li>
            </ol>
          </section>

          {/* FAQ */}
          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">3. Preguntas frecuentes</h3>

            <div className="space-y-4 mt-2">
              <div>
                <p className="font-semibold text-[#0A0A0A]">&iquest;C&oacute;mo restablezco mi contrase&ntilde;a?</p>
                <p>Las contrase&ntilde;as son administradas por tu empleador. Contacta a tu administrador o supervisor para solicitar un restablecimiento de contrase&ntilde;a.</p>
              </div>

              <div>
                <p className="font-semibold text-[#0A0A0A]">&iquest;C&oacute;mo elimino mi cuenta?</p>
                <p>Puedes solicitar la eliminaci&oacute;n de tu cuenta desde <strong>Perfil &gt; Eliminar cuenta</strong> dentro de la app, o enviando un correo a{' '}
                  <a href="mailto:support@ofjrconstruction.com" className="text-[#F97316] hover:underline">support@ofjrconstruction.com</a>.
                  Se aplica un per&iacute;odo de gracia de 30 d&iacute;as antes de la eliminaci&oacute;n permanente.
                </p>
              </div>

              <div>
                <p className="font-semibold text-[#0A0A0A]">&iquest;Por qu&eacute; la app no detecta mi ubicaci&oacute;n?</p>
                <p>Aseg&uacute;rate de que los permisos de ubicaci&oacute;n est&eacute;n habilitados en la configuraci&oacute;n de tu dispositivo. La detecci&oacute;n GPS funciona mejor al aire libre. Si el problema persiste, reinicia la app e int&eacute;ntalo de nuevo.</p>
              </div>

              <div>
                <p className="font-semibold text-[#0A0A0A]">&iquest;No puedo registrar entrada/salida &mdash; qu&eacute; hago?</p>
                <p>Verifica tu conexi&oacute;n a internet y que los permisos de ubicaci&oacute;n est&eacute;n activados. Si contin&uacute;as con problemas, contacta a tu supervisor o env&iacute;a un correo a soporte.</p>
              </div>

              <div>
                <p className="font-semibold text-[#0A0A0A]">&iquest;C&oacute;mo env&iacute;o un reporte de gastos?</p>
                <p>Navega a la secci&oacute;n de <strong>Gastos</strong> desde el men&uacute; principal. Completa el formulario, adjunta una foto del recibo usando la c&aacute;mara o galer&iacute;a, y env&iacute;alo para revisi&oacute;n de tu supervisor.</p>
              </div>

              <div>
                <p className="font-semibold text-[#0A0A0A]">&iquest;Con qui&eacute;n me comunico sobre mi horario de trabajo?</p>
                <p>Los horarios son gestionados por tu supervisor o administrador. Comun&iacute;cate directamente con ellos para consultas sobre asignaciones de proyectos y horarios.</p>
              </div>
            </div>
          </section>

          {/* Related links */}
          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">4. Documentos relacionados</h3>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li><Link to="/privacy" className="text-[#F97316] hover:underline">Pol&iacute;tica de Privacidad</Link></li>
              <li><Link to="/terms" className="text-[#F97316] hover:underline">T&eacute;rminos de Servicio</Link></li>
            </ul>
          </section>
        </article>

        {/* ==================== ENGLISH VERSION ==================== */}
        <article id="en" className="bg-white rounded-xl border border-gray-200 p-8 space-y-6 text-sm text-[#3D4752] leading-relaxed">
          <div>
            <h2 className="text-2xl font-bold text-[#0A0A0A] mb-1">Support Center</h2>
            <p className="text-xs text-[#71717A]">April 2026 &mdash; v1.0</p>
          </div>

          {/* Contact info */}
          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">1. Contact Information</h3>
            <p>If you need help with the <em>OFJR Construction</em> app, you can reach us through the following channels:</p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li><strong>Company:</strong> OFJR Construction LLC</li>
              <li><strong>Address:</strong> 5601 Hicks Ln, Oklahoma City, Oklahoma 73129, USA</li>
              <li><strong>General email:</strong>{' '}
                <a href="mailto:gerson@ofjrconstruction.com" className="text-[#F97316] hover:underline">gerson@ofjrconstruction.com</a>
              </li>
              <li><strong>Support email:</strong>{' '}
                <a href="mailto:support@ofjrconstruction.com" className="text-[#F97316] hover:underline">support@ofjrconstruction.com</a>
              </li>
            </ul>
          </section>

          {/* How to get help */}
          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">2. How to Request Help</h3>
            <p>To report an issue or request assistance:</p>
            <ol className="list-decimal pl-5 space-y-2 mt-2">
              <li>Send an email to{' '}
                <a href="mailto:support@ofjrconstruction.com" className="text-[#F97316] hover:underline">support@ofjrconstruction.com</a>
              </li>
              <li>Include a brief description of the issue in the <strong>subject line</strong> (e.g., &quot;Cannot clock in&quot;)</li>
              <li>In the body of the email, include:
                <ul className="list-disc pl-5 space-y-1 mt-1">
                  <li>Your <strong>username</strong></li>
                  <li>Your <strong>device and operating system</strong> (e.g., iPhone 15, iOS 17.4)</li>
                  <li>A <strong>detailed description</strong> of the issue</li>
                  <li>Screenshots if possible</li>
                </ul>
              </li>
              <li>Our team will respond within <strong>2 business days</strong></li>
            </ol>
          </section>

          {/* FAQ */}
          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">3. Frequently Asked Questions</h3>

            <div className="space-y-4 mt-2">
              <div>
                <p className="font-semibold text-[#0A0A0A]">How do I reset my password?</p>
                <p>Passwords are managed by your employer. Contact your administrator or supervisor to request a password reset.</p>
              </div>

              <div>
                <p className="font-semibold text-[#0A0A0A]">How do I delete my account?</p>
                <p>You can request account deletion from <strong>Profile &gt; Delete Account</strong> within the app, or by emailing{' '}
                  <a href="mailto:support@ofjrconstruction.com" className="text-[#F97316] hover:underline">support@ofjrconstruction.com</a>.
                  A 30-day grace period applies before permanent deletion.
                </p>
              </div>

              <div>
                <p className="font-semibold text-[#0A0A0A]">Why is the app not detecting my location?</p>
                <p>Make sure location permissions are enabled in your device settings. GPS detection works best outdoors. If the issue persists, restart the app and try again.</p>
              </div>

              <div>
                <p className="font-semibold text-[#0A0A0A]">I can&apos;t clock in/out &mdash; what should I do?</p>
                <p>Check your internet connection and ensure location permissions are enabled. If the problem continues, contact your supervisor or email support.</p>
              </div>

              <div>
                <p className="font-semibold text-[#0A0A0A]">How do I submit an expense report?</p>
                <p>Navigate to the <strong>Expenses</strong> section from the main menu. Fill in the form, attach a receipt photo using the camera or gallery, and submit it for your supervisor&apos;s review.</p>
              </div>

              <div>
                <p className="font-semibold text-[#0A0A0A]">Who do I contact about my work schedule?</p>
                <p>Schedules are managed by your supervisor or administrator. Contact them directly for questions about project assignments and work hours.</p>
              </div>
            </div>
          </section>

          {/* Related links */}
          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">4. Related Documents</h3>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li><Link to="/privacy" className="text-[#F97316] hover:underline">Privacy Policy</Link></li>
              <li><Link to="/terms" className="text-[#F97316] hover:underline">Terms of Service</Link></li>
            </ul>
          </section>
        </article>
      </main>
    </div>
  );
}
