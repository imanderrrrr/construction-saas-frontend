import { Link } from 'react-router';

export function TermsOfService() {
  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-[#0A0A0A]">BuildTrack</h1>
          <Link to="/terms" className="text-sm text-[#F97316] hover:underline">
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
            <h2 className="text-2xl font-bold text-[#0A0A0A] mb-1">T&eacute;rminos de Servicio</h2>
            <p className="text-xs text-[#71717A]">&Uacute;ltima actualizaci&oacute;n: 11 de abril de 2026 &mdash; v1.0</p>
          </div>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">1. Aceptaci&oacute;n de los t&eacute;rminos</h3>
            <p>
              Estos T&eacute;rminos de Servicio (&quot;T&eacute;rminos&quot;) regulan el uso de la aplicaci&oacute;n
              m&oacute;vil OFJR Construction (la &quot;App&quot;), operada por <strong>OFJR Construction LLC</strong>,
              con domicilio en 5601 Hicks Ln, Oklahoma City, Oklahoma 73129, USA. Al acceder o utilizar la App,
              usted acepta estos T&eacute;rminos. Si no est&aacute; de acuerdo, no utilice la App.
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">2. Elegibilidad</h3>
            <p>Para utilizar la App, usted debe:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Ser mayor de 18 a&ntilde;os.</li>
              <li>Ser empleado, subcontratista o socio comercial autorizado de una organizaci&oacute;n que utilice los servicios de OFJR Construction.</li>
              <li>Tener una cuenta v&aacute;lida creada o autorizada por su empleador o administrador de proyecto.</li>
            </ul>
            <p className="mt-2">La App es una herramienta de gesti&oacute;n de fuerza laboral para la industria de la construcci&oacute;n. No est&aacute; destinada al uso general del consumidor.</p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">3. Cuenta y acceso</h3>
            <p>
              Las cuentas son creadas por administradores autorizados (empleadores, supervisores o gerentes de proyecto).
              Usted no puede crear una cuenta por su cuenta. Su nivel de acceso y rol (trabajador o subcontratista)
              son determinados por su administrador.
            </p>
            <p className="mt-2">Usted es responsable de:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Mantener la confidencialidad de sus credenciales de acceso.</li>
              <li>Todas las actividades que ocurran bajo su cuenta.</li>
              <li>Notificar inmediatamente a su supervisor si sospecha de acceso no autorizado.</li>
            </ul>
            <p className="mt-2">No debe compartir sus credenciales con ninguna otra persona ni permitir que otros registren entrada/salida o env&iacute;en reportes en su nombre.</p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">4. Eliminaci&oacute;n de cuenta</h3>
            <p>
              Puede solicitar la eliminaci&oacute;n de su cuenta en cualquier momento a trav&eacute;s de la
              configuraci&oacute;n de perfil de la App o contactando a{' '}
              <a href="mailto:gerson@ofjrconstruction.com" className="text-[#F97316] hover:underline">gerson@ofjrconstruction.com</a>.
              Al eliminar su cuenta, sus datos personales ser&aacute;n eliminados de acuerdo con nuestra{' '}
              <Link to="/privacy" className="text-[#F97316] hover:underline">Pol&iacute;tica de Privacidad</Link>.
              Ciertos registros (horas, gastos) pueden retenerse seg&uacute;n lo requieran las leyes laborales y fiscales.
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">5. Uso permitido</h3>
            <p>La App se proporciona exclusivamente para fines leg&iacute;timos de gesti&oacute;n laboral. Puede utilizarla para:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Registrar entrada y salida en sitios de trabajo asignados.</li>
              <li>Ver su horario, proyectos asignados y tareas.</li>
              <li>Enviar reportes de gastos con documentaci&oacute;n de respaldo.</li>
              <li>Enviar y dar seguimiento a facturas de subcontratistas.</li>
              <li>Ver notificaciones relacionadas con sus asignaciones de trabajo.</li>
              <li>Documentar observaciones y condiciones del sitio de trabajo.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">6. Conducta prohibida</h3>
            <p>Usted acepta no:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong>Falsificar registros:</strong> enviar registros de tiempo falsos, ubicaciones fabricadas, reportes de gastos fraudulentos o documentaci&oacute;n enga&ntilde;osa.</li>
              <li><strong>Manipular ubicaci&oacute;n:</strong> usar GPS spoofing, servicios VPN u otros m&eacute;todos para falsificar su ubicaci&oacute;n geogr&aacute;fica durante el registro de entrada/salida.</li>
              <li><strong>Compartir credenciales:</strong> permitir que otra persona use su cuenta o usar la cuenta de otra persona.</li>
              <li><strong>Ingenier&iacute;a inversa:</strong> descompilar, desarmar o intentar extraer el c&oacute;digo fuente de la App.</li>
              <li><strong>Eludir seguridad:</strong> intentar eludir, desactivar o interferir con las funciones de seguridad.</li>
              <li><strong>Contenido da&ntilde;ino:</strong> subir archivos con virus, malware o material ilegal, ofensivo o que viole derechos de terceros.</li>
            </ul>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-3">
              <p className="text-amber-800">
                <strong>Importante:</strong> La falsificaci&oacute;n de registros de tiempo, gastos o ubicaci&oacute;n
                puede constituir fraude y resultar en la terminaci&oacute;n inmediata de su acceso, acciones
                disciplinarias por parte de su empleador y posibles consecuencias legales.
              </p>
            </div>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">7. Contenido del usuario</h3>
            <p>
              Usted conserva la propiedad de las fotos, documentos y textos que env&iacute;a a trav&eacute;s de la App.
              Al enviar contenido, otorga a OFJR Construction una licencia no exclusiva, libre de regal&iacute;as y
              mundial para usar, almacenar, procesar y mostrar su contenido exclusivamente para proporcionar los
              servicios de la App y para las operaciones comerciales leg&iacute;timas de su empleador.
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">8. Servicios de ubicaci&oacute;n</h3>
            <p>
              La App utiliza los servicios de ubicaci&oacute;n de su dispositivo para verificar su presencia en
              sitios de trabajo durante el registro de entrada y salida. La ubicaci&oacute;n se recopila
              &uacute;nicamente cuando usted inicia activamente una acci&oacute;n de entrada o salida. La App
              no rastrea su ubicaci&oacute;n de forma continua ni en segundo plano.
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">9. Propiedad intelectual</h3>
            <p>
              La plataforma tecnol&oacute;gica, incluyendo su dise&ntilde;o, c&oacute;digo fuente, funciones,
              arquitectura y materiales relacionados, es propiedad exclusiva de ArchLogic Systems y est&aacute;
              protegida por las leyes de propiedad intelectual de Estados Unidos e internacionales. Los logotipos,
              marcas comerciales y contenido espec&iacute;fico de la empresa son propiedad de OFJR Construction LLC.
              Estos T&eacute;rminos no le otorgan ning&uacute;n derecho sobre la App m&aacute;s all&aacute; de una
              licencia limitada, no exclusiva, intransferible y revocable para usar la App de acuerdo con estos
              T&eacute;rminos.
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">10. Disponibilidad y modificaciones</h3>
            <p>
              Nos esforzamos por mantener la disponibilidad de la App, pero no garantizamos un funcionamiento
              ininterrumpido o libre de errores. Nos reservamos el derecho de modificar, actualizar o
              descontinuar la App o cualquiera de sus funciones en cualquier momento.
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">11. Exenci&oacute;n de garant&iacute;as</h3>
            <p className="uppercase font-medium">
              La App se proporciona &quot;tal cual&quot; y &quot;seg&uacute;n disponibilidad&quot;, sin
              garant&iacute;as de ning&uacute;n tipo, expresas o impl&iacute;citas. En la medida m&aacute;xima
              permitida por la ley, OFJR Construction renuncia a todas las garant&iacute;as, incluyendo las
              garant&iacute;as impl&iacute;citas de comerciabilidad, idoneidad para un prop&oacute;sito particular
              y no infracci&oacute;n.
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">12. Limitaci&oacute;n de responsabilidad</h3>
            <p className="uppercase font-medium">
              En la medida m&aacute;xima permitida por la ley, OFJR Construction LLC no ser&aacute; responsable
              por da&ntilde;os indirectos, incidentales, especiales, consecuentes o punitivos. Nuestra
              responsabilidad total no exceder&aacute; cien d&oacute;lares estadounidenses ($100.00 USD).
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">13. Indemnizaci&oacute;n</h3>
            <p>
              Usted acepta indemnizar y mantener indemne a OFJR Construction LLC de cualquier reclamo, da&ntilde;o,
              p&eacute;rdida y gasto derivado de su uso de la App, violaci&oacute;n de estos T&eacute;rminos o
              falsificaci&oacute;n de registros, ubicaciones o documentaci&oacute;n.
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">14. Terminaci&oacute;n</h3>
            <p>
              Podemos suspender o terminar su acceso a la App en cualquier momento, con o sin causa y con o sin
              previo aviso. Motivos comunes incluyen: violaci&oacute;n de estos T&eacute;rminos, solicitud de su
              empleador, actividad fraudulenta sospechada o discontinuaci&oacute;n de la App.
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">15. Ley aplicable y resoluci&oacute;n de disputas</h3>
            <p>
              Estos T&eacute;rminos se regir&aacute;n por las leyes del Estado de Oklahoma, Estados Unidos.
              Cualquier disputa se resolver&aacute; primero mediante negociaci&oacute;n de buena fe. Si la
              negociaci&oacute;n fracasa, las disputas se resolver&aacute;n mediante arbitraje vinculante en
              Oklahoma City, Oklahoma. Usted renuncia a cualquier derecho a participar en una acci&oacute;n
              colectiva o arbitraje colectivo.
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">16. Cambios a estos t&eacute;rminos</h3>
            <p>
              Podemos actualizar estos T&eacute;rminos peri&oacute;dicamente. Cuando hagamos cambios materiales,
              actualizaremos la fecha de &quot;&Uacute;ltima actualizaci&oacute;n&quot; y le notificaremos a trav&eacute;s
              de la App. El uso continuado de la App despu&eacute;s de los cambios constituye la aceptaci&oacute;n
              de los T&eacute;rminos actualizados.
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">17. Contacto</h3>
            <p>
              Si tiene preguntas sobre estos T&eacute;rminos de Servicio, puede contactarnos en:{' '}
              <a href="mailto:gerson@ofjrconstruction.com" className="text-[#F97316] hover:underline">
                gerson@ofjrconstruction.com
              </a>
            </p>
            <p className="mt-2">
              <strong>OFJR Construction LLC</strong><br />
              5601 Hicks Ln, Oklahoma City, Oklahoma 73129, USA
            </p>
          </section>
        </article>

        {/* ==================== ENGLISH VERSION ==================== */}
        <article id="en" className="bg-white rounded-xl border border-gray-200 p-8 space-y-6 text-sm text-[#3D4752] leading-relaxed">
          <div>
            <h2 className="text-2xl font-bold text-[#0A0A0A] mb-1">Terms of Service</h2>
            <p className="text-xs text-[#71717A]">Last updated: April 11, 2026 &mdash; v1.0</p>
          </div>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">1. Acceptance of terms</h3>
            <p>
              These Terms of Service (&quot;Terms&quot;) govern your use of the OFJR Construction mobile
              application (the &quot;App&quot;), operated by <strong>OFJR Construction LLC</strong>, located at
              5601 Hicks Ln, Oklahoma City, Oklahoma 73129, USA. By accessing or using the App, you agree to
              be bound by these Terms. If you do not agree, do not use the App.
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">2. Eligibility</h3>
            <p>To use the App, you must:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Be at least 18 years of age.</li>
              <li>Be an authorized employee, subcontractor, or business partner of an organization using OFJR Construction&rsquo;s services.</li>
              <li>Have a valid account created or authorized by your employer or project administrator.</li>
            </ul>
            <p className="mt-2">The App is a workforce management tool for the construction industry. It is not intended for general consumer use.</p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">3. Account and access</h3>
            <p>
              Accounts are created by authorized administrators (employers, supervisors, or project managers).
              You may not create an account on your own. Your access level and role (worker or subcontractor)
              are determined by your administrator.
            </p>
            <p className="mt-2">You are responsible for:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Maintaining the confidentiality of your login credentials.</li>
              <li>All activities that occur under your account.</li>
              <li>Immediately notifying your supervisor if you suspect unauthorized access.</li>
            </ul>
            <p className="mt-2">You must not share your credentials with any other person or allow others to check in, check out, or submit reports on your behalf.</p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">4. Account deletion</h3>
            <p>
              You may request deletion of your account at any time through the App&rsquo;s Profile settings or by
              contacting{' '}
              <a href="mailto:gerson@ofjrconstruction.com" className="text-[#F97316] hover:underline">gerson@ofjrconstruction.com</a>.
              Upon deletion, your personal data will be removed in accordance with our{' '}
              <Link to="/privacy" className="text-[#F97316] hover:underline">Privacy Policy</Link>.
              Certain records (time entries, expense reports) may be retained as required by labor laws and tax regulations.
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">5. Permitted use</h3>
            <p>The App is provided solely for legitimate workforce management purposes. You may use it to:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Check in and check out at assigned job sites.</li>
              <li>View your work schedule, assigned projects, and tasks.</li>
              <li>Submit expense reports with supporting documentation.</li>
              <li>Submit and track subcontractor invoices.</li>
              <li>View notifications related to your work assignments.</li>
              <li>Document job site observations and conditions.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">6. Prohibited conduct</h3>
            <p>You agree not to:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong>Falsify records:</strong> submit false time entries, fabricated locations, fraudulent expense reports, or misleading documentation.</li>
              <li><strong>Manipulate location:</strong> use GPS spoofing, VPN services, or any other method to falsify your geographic location.</li>
              <li><strong>Share credentials:</strong> allow another person to use your account or use another person&rsquo;s account.</li>
              <li><strong>Reverse engineer:</strong> decompile, disassemble, or attempt to extract the source code of the App.</li>
              <li><strong>Circumvent security:</strong> attempt to bypass, disable, or interfere with any security features.</li>
              <li><strong>Upload harmful content:</strong> upload files containing viruses, malware, or illegal/offensive material.</li>
            </ul>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-3">
              <p className="text-amber-800">
                <strong>Important:</strong> Falsifying time records, expense reports, or location data may constitute
                fraud and may result in immediate termination of your access, disciplinary action by your employer,
                and potential legal consequences.
              </p>
            </div>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">7. User content</h3>
            <p>
              You retain ownership of photos, documents, and text you submit through the App. By submitting
              content, you grant OFJR Construction a non-exclusive, royalty-free, worldwide license to use,
              store, process, and display your content solely for the purpose of providing the App&rsquo;s services
              and for your employer&rsquo;s legitimate business operations.
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">8. Location services</h3>
            <p>
              The App uses your device&rsquo;s location services to verify your presence at job sites during
              check-in and check-out. Location data is collected only when you actively initiate a check-in
              or check-out action. The App does not track your location continuously or in the background.
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">9. Intellectual property</h3>
            <p>
              The technology platform, including its design, source code, features, architecture, and all
              related materials, is the exclusive property of ArchLogic Systems and is protected by United
              States and international intellectual property laws. Company-specific logos, trademarks, and
              content are the property of OFJR Construction LLC. These Terms grant you only a limited,
              non-exclusive, non-transferable, revocable license to use the App in accordance with these Terms.
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">10. Availability and modifications</h3>
            <p>
              We strive to maintain the App&rsquo;s availability but do not guarantee uninterrupted or error-free
              operation. We reserve the right to modify, update, or discontinue the App or any of its features
              at any time.
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">11. Disclaimers</h3>
            <p className="uppercase font-medium">
              The App is provided on an &quot;as is&quot; and &quot;as available&quot; basis, without warranties
              of any kind, whether express, implied, or statutory. To the maximum extent permitted by law,
              OFJR Construction disclaims all warranties, including implied warranties of merchantability,
              fitness for a particular purpose, and non-infringement.
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">12. Limitation of liability</h3>
            <p className="uppercase font-medium">
              To the maximum extent permitted by applicable law, OFJR Construction LLC shall not be liable for
              any indirect, incidental, special, consequential, or punitive damages. Our total liability shall
              not exceed one hundred U.S. dollars ($100.00).
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">13. Indemnification</h3>
            <p>
              You agree to indemnify and hold harmless OFJR Construction LLC from any claims, damages, losses,
              and expenses arising from your use of the App, violation of these Terms, or falsification of
              records, locations, or documentation.
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">14. Termination</h3>
            <p>
              We may suspend or terminate your access to the App at any time, with or without cause, and with
              or without notice. Common grounds include: violation of these Terms, request from your employer,
              suspected fraudulent activity, or discontinuation of the App.
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">15. Governing law and dispute resolution</h3>
            <p>
              These Terms shall be governed by the laws of the State of Oklahoma, United States. Any dispute
              shall first be attempted to be resolved through good-faith negotiation. If negotiation fails,
              disputes shall be resolved through binding arbitration in Oklahoma City, Oklahoma. You waive any
              right to participate in a class action or class arbitration.
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">16. Changes to these terms</h3>
            <p>
              We may update these Terms from time to time. When we make material changes, we will update the
              &quot;Last Updated&quot; date and notify you through the App. Your continued use of the App after
              changes are posted constitutes acceptance of the updated Terms.
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">17. Contact</h3>
            <p>
              If you have questions about these Terms of Service, please contact us at:{' '}
              <a href="mailto:gerson@ofjrconstruction.com" className="text-[#F97316] hover:underline">
                gerson@ofjrconstruction.com
              </a>
            </p>
            <p className="mt-2">
              <strong>OFJR Construction LLC</strong><br />
              5601 Hicks Ln, Oklahoma City, Oklahoma 73129, USA
            </p>
          </section>
        </article>
      </main>
    </div>
  );
}
