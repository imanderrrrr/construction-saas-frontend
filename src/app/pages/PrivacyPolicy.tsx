import { Link } from 'react-router';

export function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-[#0A0A0A]">BuildTrack</h1>
          <Link to="/privacy" className="text-sm text-[#F97316] hover:underline">
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
            <h2 className="text-2xl font-bold text-[#0A0A0A] mb-1">Pol&iacute;tica de Privacidad</h2>
            <p className="text-xs text-[#71717A]">&Uacute;ltima actualizaci&oacute;n: 4 de abril de 2026 &mdash; v1.0</p>
          </div>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">1. Responsable del tratamiento</h3>
            <p>
              <strong>OFJR Construction LLC</strong> (&quot;nosotros&quot;, &quot;la empresa&quot;),
              con domicilio en <strong>5601 Hicks Ln, Oklahoma City, Oklahoma 73129, USA</strong>,
              registrada en <strong>Estados Unidos</strong>
              {' '}(EIN 99-0643939),
              opera la aplicaci&oacute;n m&oacute;vil <em>OFJR Construction</em> y el panel web asociado.
              Esta pol&iacute;tica describe c&oacute;mo recopilamos, usamos y protegemos la informaci&oacute;n
              de los usuarios de nuestros servicios.
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">2. Base legal para el tratamiento</h3>
            <p>Tratamos sus datos personales con base en los siguientes fundamentos legales:</p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>
                <strong>Ejecuci&oacute;n contractual:</strong> el tratamiento es necesario para la gesti&oacute;n
                de la relaci&oacute;n laboral entre el usuario y su empleador o contratista principal (registro
                de asistencia, horas de trabajo, facturaci&oacute;n).
              </li>
              <li>
                <strong>Inter&eacute;s leg&iacute;timo:</strong> seguridad de la plataforma, prevenci&oacute;n
                de fraude y mejora del servicio.
              </li>
              <li>
                <strong>Consentimiento:</strong> para el acceso a
                permisos del dispositivo (ubicaci&oacute;n, c&aacute;mara, galer&iacute;a). El usuario puede
                revocar estos permisos en cualquier momento desde la configuraci&oacute;n de su dispositivo.
              </li>
              <li>
                <strong>Obligaci&oacute;n legal:</strong> retenci&oacute;n de registros laborales y fiscales
                seg&uacute;n la legislaci&oacute;n aplicable.
              </li>
            </ul>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">3. Datos que recopilamos</h3>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Datos de cuenta:</strong> nombre de usuario, nombre completo, correo electr&oacute;nico,
                n&uacute;mero de tel&eacute;fono y rol asignado (trabajador, subcontratista, supervisor, etc.).
              </li>
              <li>
                <strong>Ubicaci&oacute;n (GPS):</strong> se utiliza exclusivamente para verificar la presencia
                del usuario en el sitio de obra asignado (geofencing). La ubicaci&oacute;n se captura &uacute;nicamente
                al registrar entrada/salida de jornada y no se rastrea en segundo plano. Se utiliza
                ubicaci&oacute;n precisa (ACCESS_FINE_LOCATION) para garantizar la exactitud de la
                verificaci&oacute;n geogr&aacute;fica.
              </li>
              <li>
                <strong>C&aacute;mara y galer&iacute;a de fotos:</strong> se accede a la c&aacute;mara y
                galer&iacute;a para capturar recibos de gastos, evidencia fotogr&aacute;fica de avance de obra
                y documentos de facturaci&oacute;n. Las im&aacute;genes se almacenan en servidores seguros y no
                se comparten con terceros.
              </li>
              <li>
                <strong>Registro de horas de trabajo:</strong> hora de entrada, hora de salida, proyecto
                asignado y ubicaci&oacute;n del registro.
              </li>
              <li>
                <strong>Datos financieros:</strong> facturas emitidas, montos, conceptos y estados de pago
                relacionados con la actividad laboral del usuario en la plataforma.
              </li>
              <li>
                <strong>Datos t&eacute;cnicos:</strong> direcci&oacute;n IP, tipo de dispositivo, sistema
                operativo, versi&oacute;n de la aplicaci&oacute;n e identificadores de diagn&oacute;stico,
                recopilados autom&aacute;ticamente para diagn&oacute;stico y seguridad.
              </li>
            </ul>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">4. Finalidad del tratamiento</h3>
            <p>Utilizamos la informaci&oacute;n recopilada para:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Autenticar y gestionar la cuenta del usuario.</li>
              <li>Registrar y verificar asistencia y horas de trabajo en sitios de obra.</li>
              <li>Gestionar la asignaci&oacute;n de trabajos a subcontratistas y el seguimiento de su avance.</li>
              <li>Procesar facturas, gastos y pagos asociados a la actividad laboral.</li>
              <li>Enviar notificaciones relacionadas con la actividad del usuario en la plataforma.</li>
              <li>Mejorar la seguridad y el rendimiento de la aplicaci&oacute;n.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">5. Servicios de terceros</h3>
            <p>
              La aplicaci&oacute;n utiliza los siguientes servicios de terceros que pueden recopilar
              informaci&oacute;n de acuerdo con sus propias pol&iacute;ticas de privacidad:
            </p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>
                <strong>Google Play Services:</strong> necesario para el funcionamiento de la aplicaci&oacute;n
                en dispositivos Android. Puede recopilar informaci&oacute;n del dispositivo e identificadores.
                {' '}<a href="https://policies.google.com/privacy" className="text-[#F97316] hover:underline" target="_blank" rel="noopener noreferrer">
                  Pol&iacute;tica de privacidad de Google
                </a>.
              </li>
              <li>
                <strong>Supabase:</strong> proveedor de base de datos y autenticaci&oacute;n. Los datos se
                almacenan en servidores de Amazon Web Services (AWS).
                {' '}<a href="https://supabase.com/privacy" className="text-[#F97316] hover:underline" target="_blank" rel="noopener noreferrer">
                  Pol&iacute;tica de privacidad de Supabase
                </a>.
              </li>
              <li>
                <strong>Vercel:</strong> proveedor de hosting para el panel web.
                {' '}<a href="https://vercel.com/legal/privacy-policy" className="text-[#F97316] hover:underline" target="_blank" rel="noopener noreferrer">
                  Pol&iacute;tica de privacidad de Vercel
                </a>.
              </li>
            </ul>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">6. Compartici&oacute;n de datos</h3>
            <p>
              No vendemos, alquilamos ni compartimos informaci&oacute;n personal con terceros con fines
              comerciales. Los datos pueden ser compartidos &uacute;nicamente con:
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>El empleador o contratista principal del usuario, en el contexto de la relaci&oacute;n laboral.</li>
              <li>Los proveedores de servicios tecnol&oacute;gicos indicados en la secci&oacute;n 5, que operan bajo
                  acuerdos de confidencialidad y procesamiento de datos.</li>
              <li>Autoridades competentes cuando lo requiera la ley.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">7. Transferencias internacionales de datos</h3>
            <p>
              Sus datos pueden ser transferidos y almacenados en servidores ubicados fuera de su pa&iacute;s de
              residencia, incluyendo Estados Unidos (AWS/Supabase, Vercel). Estas transferencias se realizan
              bajo las cl&aacute;usulas contractuales est&aacute;ndar de los proveedores y las pol&iacute;ticas
              de protecci&oacute;n de datos de cada servicio indicadas en la secci&oacute;n 5.
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">8. Almacenamiento y seguridad</h3>
            <p>
              Los datos se almacenan en servidores seguros con cifrado en tr&aacute;nsito (TLS/HTTPS) y en
              reposo. Los tokens de autenticaci&oacute;n se almacenan de forma cifrada en el dispositivo del
              usuario. Implementamos controles de acceso basados en roles (RBAC) para limitar el acceso a la
              informaci&oacute;n.
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">9. Permisos del dispositivo</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse mt-2">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="py-2 pr-4 font-semibold text-[#0A0A0A]">Permiso</th>
                    <th className="py-2 font-semibold text-[#0A0A0A]">Motivo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="py-2 pr-4">Ubicaci&oacute;n precisa (GPS)</td>
                    <td className="py-2">Verificaci&oacute;n de presencia en sitio de obra (geofencing)</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">C&aacute;mara</td>
                    <td className="py-2">Captura de recibos y evidencia fotogr&aacute;fica</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">Almacenamiento / Galer&iacute;a</td>
                    <td className="py-2">Adjuntar im&aacute;genes existentes como evidencia o recibos</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">Internet</td>
                    <td className="py-2">Comunicaci&oacute;n con el servidor de la aplicaci&oacute;n</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">10. Retenci&oacute;n de datos</h3>
            <p>
              Los datos personales se conservan mientras la cuenta del usuario est&eacute; activa. Al
              desactivar una cuenta, los datos se retienen durante
              {' '}<strong>3 a&ntilde;os</strong> adicionales para cumplir con las
              obligaciones legales laborales y fiscales aplicables, tras lo cual se eliminan de forma segura.
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">11. Derechos del usuario</h3>
            <p>El usuario tiene derecho a:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Acceder a sus datos personales almacenados en la plataforma.</li>
              <li>Solicitar la correcci&oacute;n de datos inexactos.</li>
              <li>Solicitar la eliminaci&oacute;n de su cuenta y datos asociados.</li>
              <li>Solicitar la portabilidad de sus datos en un formato legible por m&aacute;quina.</li>
              <li>Revocar permisos del dispositivo en cualquier momento desde la configuraci&oacute;n del sistema operativo.</li>
            </ul>
            <p className="mt-2">
              Para ejercer estos derechos, env&iacute;e un correo electr&oacute;nico a{' '}
              <a href="mailto:gerson@ofjrconstruction.com" className="text-[#F97316] hover:underline">
                gerson@ofjrconstruction.com
              </a>{' '}
              con el asunto &quot;Solicitud de privacidad&quot;. Responderemos en un plazo m&aacute;ximo de
              {' '}<strong>30 d&iacute;as</strong> h&aacute;biles.
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">12. Usuarios menores de edad</h3>
            <p>
              Esta aplicaci&oacute;n est&aacute; dise&ntilde;ada exclusivamente para usuarios mayores de 18
              a&ntilde;os en el contexto de relaciones laborales. No recopilamos intencionalmente informaci&oacute;n
              de menores de 13 a&ntilde;os. Si detectamos que un menor ha proporcionado datos personales,
              procederemos a eliminarlos de inmediato.
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">13. Cookies y tecnolog&iacute;as de seguimiento</h3>
            <p>
              La aplicaci&oacute;n m&oacute;vil no utiliza cookies. El panel web utiliza almacenamiento local del
              navegador (&uacute;nicamente para tokens de sesi&oacute;n) y no emplea cookies de seguimiento,
              publicidad ni anal&iacute;ticas de terceros.
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">14. Cambios a esta pol&iacute;tica</h3>
            <p>
              Nos reservamos el derecho de actualizar esta pol&iacute;tica. Las modificaciones se publicar&aacute;n
              en esta misma p&aacute;gina con la fecha y versi&oacute;n de actualizaci&oacute;n correspondiente.
              Notificaremos a los usuarios sobre cambios materiales a trav&eacute;s de la aplicaci&oacute;n. El
              uso continuado de la aplicaci&oacute;n despu&eacute;s de los cambios constituye la aceptaci&oacute;n
              de los mismos.
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">15. Contacto</h3>
            <p>
              Si tiene preguntas sobre esta pol&iacute;tica de privacidad, puede contactarnos en:{' '}
              <a href="mailto:gerson@ofjrconstruction.com" className="text-[#F97316] hover:underline">
                gerson@ofjrconstruction.com
              </a>
            </p>
          </section>
        </article>

        {/* ==================== ENGLISH VERSION ==================== */}
        <article id="en" className="bg-white rounded-xl border border-gray-200 p-8 space-y-6 text-sm text-[#3D4752] leading-relaxed">
          <div>
            <h2 className="text-2xl font-bold text-[#0A0A0A] mb-1">Privacy Policy</h2>
            <p className="text-xs text-[#71717A]">Last updated: April 4, 2026 &mdash; v1.0</p>
          </div>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">1. Data controller</h3>
            <p>
              <strong>OFJR Construction LLC</strong> (&quot;we&quot;, &quot;the company&quot;),
              located at <strong>5601 Hicks Ln, Oklahoma City, Oklahoma 73129, USA</strong>,
              registered in <strong>the United States</strong>
              {' '}(EIN 99-0643939),
              operates the <em>OFJR Construction</em> mobile application and its associated web panel.
              This policy describes how we collect, use, and protect the information of our service users.
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">2. Legal basis for processing</h3>
            <p>We process your personal data on the following legal grounds:</p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>
                <strong>Contractual performance:</strong> processing is necessary for managing the employment
                relationship between the user and their employer or main contractor (attendance tracking,
                work hours, invoicing).
              </li>
              <li>
                <strong>Legitimate interest:</strong> platform security, fraud prevention, and service improvement.
              </li>
              <li>
                <strong>Consent:</strong> for accessing device permissions
                (location, camera, gallery). Users may revoke these permissions at any time through their
                device settings.
              </li>
              <li>
                <strong>Legal obligation:</strong> retention of labor and tax records as required by applicable law.
              </li>
            </ul>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">3. Data we collect</h3>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Account data:</strong> username, full name, email address, phone number, and assigned
                role (worker, subcontractor, supervisor, etc.).
              </li>
              <li>
                <strong>Location (GPS):</strong> used exclusively to verify user presence at the assigned
                construction site (geofencing). Location is captured only when clocking in/out and is not
                tracked in the background. Precise location (ACCESS_FINE_LOCATION) is used to ensure
                geographic verification accuracy.
              </li>
              <li>
                <strong>Camera and photo gallery:</strong> accessed to capture expense receipts, photographic
                evidence of construction progress, and invoicing documents. Images are stored on secure servers
                and are not shared with third parties.
              </li>
              <li>
                <strong>Work hour records:</strong> clock-in time, clock-out time, assigned project, and
                check-in location.
              </li>
              <li>
                <strong>Financial data:</strong> invoices issued, amounts, descriptions, and payment statuses
                related to the user&rsquo;s work activity on the platform.
              </li>
              <li>
                <strong>Technical data:</strong> IP address, device type, operating system, app version, and
                diagnostic identifiers, collected automatically for diagnostics and security.
              </li>
            </ul>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">4. Purpose of processing</h3>
            <p>We use the collected information to:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Authenticate and manage the user&rsquo;s account.</li>
              <li>Record and verify attendance and work hours at construction sites.</li>
              <li>Manage work assignments to subcontractors and track their progress.</li>
              <li>Process invoices, expenses, and payments associated with work activity.</li>
              <li>Send notifications related to the user&rsquo;s platform activity.</li>
              <li>Improve application security and performance.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">5. Third-party services</h3>
            <p>
              The application uses the following third-party services that may collect information
              according to their own privacy policies:
            </p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>
                <strong>Google Play Services:</strong> required for app operation on Android devices. May
                collect device information and identifiers.
                {' '}<a href="https://policies.google.com/privacy" className="text-[#F97316] hover:underline" target="_blank" rel="noopener noreferrer">
                  Google Privacy Policy
                </a>.
              </li>
              <li>
                <strong>Supabase:</strong> database and authentication provider. Data is stored on Amazon Web
                Services (AWS) servers.
                {' '}<a href="https://supabase.com/privacy" className="text-[#F97316] hover:underline" target="_blank" rel="noopener noreferrer">
                  Supabase Privacy Policy
                </a>.
              </li>
              <li>
                <strong>Vercel:</strong> hosting provider for the web panel.
                {' '}<a href="https://vercel.com/legal/privacy-policy" className="text-[#F97316] hover:underline" target="_blank" rel="noopener noreferrer">
                  Vercel Privacy Policy
                </a>.
              </li>
            </ul>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">6. Data sharing</h3>
            <p>
              We do not sell, rent, or share personal information with third parties for commercial purposes.
              Data may be shared only with:
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>The user&rsquo;s employer or main contractor, in the context of the employment relationship.</li>
              <li>The technology service providers listed in section 5, operating under confidentiality and
                  data processing agreements.</li>
              <li>Competent authorities when required by law.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">7. International data transfers</h3>
            <p>
              Your data may be transferred to and stored on servers located outside your country of residence,
              including the United States (AWS/Supabase, Vercel). These transfers are carried out under the
              standard contractual clauses of the providers and the data protection policies of each service
              listed in section 5.
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">8. Storage and security</h3>
            <p>
              Data is stored on secure servers with encryption in transit (TLS/HTTPS) and at rest.
              Authentication tokens are stored in encrypted form on the user&rsquo;s device. We implement
              role-based access controls (RBAC) to limit access to information.
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">9. Device permissions</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse mt-2">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="py-2 pr-4 font-semibold text-[#0A0A0A]">Permission</th>
                    <th className="py-2 font-semibold text-[#0A0A0A]">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="py-2 pr-4">Precise location (GPS)</td>
                    <td className="py-2">Construction site presence verification (geofencing)</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">Camera</td>
                    <td className="py-2">Capture receipts and photographic evidence</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">Storage / Gallery</td>
                    <td className="py-2">Attach existing images as evidence or receipts</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">Internet</td>
                    <td className="py-2">Communication with the application server</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">10. Data retention</h3>
            <p>
              Personal data is retained while the user&rsquo;s account is active. Upon account deactivation,
              data is retained for an additional
              {' '}<strong>3 years</strong> to comply with applicable labor and tax
              legal obligations, after which it is securely deleted.
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">11. User rights</h3>
            <p>Users have the right to:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Access their personal data stored on the platform.</li>
              <li>Request correction of inaccurate data.</li>
              <li>Request deletion of their account and associated data.</li>
              <li>Request data portability in a machine-readable format.</li>
              <li>Revoke device permissions at any time through operating system settings.</li>
            </ul>
            <p className="mt-2">
              To exercise these rights, send an email to{' '}
              <a href="mailto:gerson@ofjrconstruction.com" className="text-[#F97316] hover:underline">
                gerson@ofjrconstruction.com
              </a>{' '}
              with the subject line &quot;Privacy request&quot;. We will respond within a maximum of
              {' '}<strong>30 business days</strong>.
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">12. Children&rsquo;s privacy</h3>
            <p>
              This application is designed exclusively for users aged 18 and over in the context of
              employment relationships. We do not knowingly collect information from children under 13.
              If we become aware that a child has provided personal data, we will promptly delete it.
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">13. Cookies and tracking technologies</h3>
            <p>
              The mobile application does not use cookies. The web panel uses browser local storage
              (solely for session tokens) and does not employ tracking cookies, advertising cookies,
              or third-party analytics.
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">14. Changes to this policy</h3>
            <p>
              We reserve the right to update this policy. Changes will be posted on this page with the
              corresponding update date and version number. Users will be notified of material changes
              through the application. Continued use of the application after changes constitutes
              acceptance thereof.
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">15. Contact</h3>
            <p>
              If you have questions about this privacy policy, you can contact us at:{' '}
              <a href="mailto:gerson@ofjrconstruction.com" className="text-[#F97316] hover:underline">
                gerson@ofjrconstruction.com
              </a>
            </p>
          </section>
        </article>
      </main>
    </div>
  );
}
