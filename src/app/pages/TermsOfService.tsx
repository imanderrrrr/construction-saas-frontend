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
          <a href="#es" className="text-sm text-[#F97316] hover:underline">Español</a>
          <span className="text-sm text-[#71717A]">|</span>
          <a href="#en" className="text-sm text-[#F97316] hover:underline">English</a>
        </div>

        {/* ==================== SPANISH VERSION ==================== */}
        <article id="es" className="bg-white rounded-xl border border-gray-200 p-8 space-y-6 text-sm text-[#3D4752] leading-relaxed mb-8">
          <div>
            <h2 className="text-2xl font-bold text-[#0A0A0A] mb-1">Términos de Servicio</h2>
            <p className="text-xs text-[#71717A]">Última actualización: 4 de julio de 2026 — v2.0</p>
          </div>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">1. Aceptación y alcance</h3>
            <p>
              Estos Términos de Servicio (&quot;Términos&quot;) regulan el uso de BuildTrack —la aplicación
              móvil BuildTrack Mobile y el panel web—, operada por Archlogic Systems, con domicilio en
              2a calle, zona 3, Huehuetenango, Guatemala. Al acceder o usar BuildTrack, usted acepta estos
              Términos. Si no está de acuerdo, no use la plataforma.
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">2. Definiciones</h3>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Cliente:</strong> la empresa u organización que contrata una suscripción a BuildTrack para gestionar a su personal.</li>
              <li><strong>Usuario Autorizado:</strong> la persona (trabajador, subcontratista, supervisor o administrador) a la que un Cliente concede acceso a la plataforma.</li>
              <li><strong>Archlogic:</strong> Archlogic Systems, proveedor de la plataforma. No es empleador de los Usuarios Autorizados.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">3. Elegibilidad</h3>
            <p>
              Para usar BuildTrack, usted debe ser mayor de 18 años y estar autorizado por un Cliente. Los
              Usuarios Autorizados acceden mediante cuentas creadas o habilitadas por su Cliente (o mediante
              registro por código QR). BuildTrack es una herramienta de gestión laboral para la construcción;
              no está destinada al uso general del consumidor.
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">4. Relación con su empleador</h3>
            <p>
              BuildTrack es una herramienta que Archlogic pone a disposición del Cliente. Archlogic no es su
              empleador ni parte de su relación laboral o comercial. El Cliente es el único responsable de esa
              relación, de las cuentas que crea, de las asignaciones de trabajo y del uso que da a la plataforma
              y a los datos de su personal.
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">5. Cuentas y acceso</h3>
            <p>
              Las cuentas de los Usuarios Autorizados las crean o habilitan los administradores del Cliente. Su
              nivel de acceso y rol los determina su Cliente. Usted es responsable de:
            </p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>Mantener la confidencialidad de sus credenciales (código QR, PIN o contraseña).</li>
              <li>Todas las actividades que ocurran bajo su cuenta.</li>
              <li>Notificar de inmediato a su supervisor o al Cliente si sospecha de acceso no autorizado.</li>
            </ul>
            <p className="mt-2">No debe compartir sus credenciales ni permitir que otra persona fiche o envíe reportes en su nombre.</p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">6. Suscripción y pagos</h3>
            <p>
              El acceso a BuildTrack para un Cliente se contrata mediante una suscripción. Los pagos se procesan
              a través de Paddle, que actúa como comerciante registrado. Los precios, ciclos de facturación,
              períodos de prueba y condiciones de cancelación se muestran al momento de la contratación. Los
              Usuarios Autorizados individuales no realizan ningún pago por usar la app. La falta de pago de la
              suscripción puede suspender el acceso del Cliente y de sus Usuarios Autorizados.
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">7. Eliminación de cuenta</h3>
            <p>
              Usted puede solicitar la eliminación de su cuenta en cualquier momento desde la sección de perfil
              de la app o escribiendo a{' '}
              <a href="mailto:andersonaguirre794@gmail.com" className="text-[#F97316] hover:underline">andersonaguirre794@gmail.com</a>.
              Al eliminarla, sus datos personales se tratan conforme a la{' '}
              <Link to="/privacy" className="text-[#F97316] hover:underline">Política de Privacidad</Link>.
              Ciertos registros (horas, gastos) pueden conservarse según lo exijan las obligaciones legales y
              fiscales aplicables a su Cliente.
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">8. Uso permitido</h3>
            <p>BuildTrack se ofrece exclusivamente para fines legítimos de gestión laboral. Puede usarla para:</p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>Registrar entrada y salida en los sitios de trabajo asignados.</li>
              <li>Ver su horario, proyectos y tareas.</li>
              <li>Enviar reportes de gastos con documentación de respaldo.</li>
              <li>Enviar y dar seguimiento a facturas de subcontratistas.</li>
              <li>Ver notificaciones de sus asignaciones.</li>
              <li>Documentar observaciones y condiciones del sitio de trabajo.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">9. Conducta prohibida</h3>
            <p>Usted acepta no:</p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li><strong>Falsificar registros:</strong> enviar marcas de tiempo falsas, ubicaciones fabricadas, gastos fraudulentos o documentación engañosa.</li>
              <li><strong>Manipular la ubicación:</strong> usar GPS falso, VPN u otros métodos para falsear su ubicación al fichar.</li>
              <li>Compartir credenciales o usar la cuenta de otra persona.</li>
              <li><strong>Realizar ingeniería inversa:</strong> descompilar o intentar extraer el código de la plataforma.</li>
              <li><strong>Eludir la seguridad:</strong> intentar sortear o interferir con las funciones de seguridad.</li>
              <li><strong>Subir contenido dañino:</strong> archivos con virus, malware o material ilegal u ofensivo.</li>
            </ul>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-3">
              <p className="text-amber-800">
                <strong>Importante:</strong> falsificar registros de tiempo, gastos o ubicación puede constituir
                fraude y derivar en la suspensión inmediata del acceso, acciones disciplinarias por parte de su
                empleador y posibles consecuencias legales.
              </p>
            </div>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">10. Contenido del usuario</h3>
            <p>
              Usted y su Cliente conservan la propiedad de las fotos, documentos y textos enviados a través de
              BuildTrack. Al enviar contenido, usted otorga a Archlogic una licencia no exclusiva, libre de
              regalías y mundial para alojar, procesar y mostrar dicho contenido con el único fin de prestar el
              servicio por cuenta de su Cliente.
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">11. Servicios de ubicación</h3>
            <p>
              BuildTrack usa la ubicación de su dispositivo para verificar su presencia en los sitios de trabajo
              al fichar. La ubicación se recopila únicamente cuando usted inicia activamente una entrada o salida;
              la app no rastrea su ubicación de forma continua ni en segundo plano.
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">12. Propiedad intelectual</h3>
            <p>
              BuildTrack, incluyendo su diseño, código, funciones, logotipos y marcas, es propiedad exclusiva de
              Archlogic Systems y está protegida por las leyes de propiedad intelectual aplicables. Estos Términos
              le otorgan únicamente una licencia limitada, no exclusiva, intransferible y revocable para usar la
              plataforma conforme a ellos.
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">13. Disponibilidad y modificaciones</h3>
            <p>
              Nos esforzamos por mantener la disponibilidad de BuildTrack, pero no garantizamos un funcionamiento
              ininterrumpido o libre de errores. Nos reservamos el derecho de modificar, actualizar o descontinuar
              la plataforma o cualquiera de sus funciones en cualquier momento.
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">14. Exención de garantías</h3>
            <p className="uppercase font-medium">
              LA PLATAFORMA SE PROPORCIONA &quot;TAL CUAL&quot; Y &quot;SEGÚN DISPONIBILIDAD&quot;, SIN GARANTÍAS
              DE NINGÚN TIPO, EXPRESAS O IMPLÍCITAS. EN LA MEDIDA MÁXIMA PERMITIDA POR LA LEY, ARCHLOGIC SYSTEMS
              RENUNCIA A TODAS LAS GARANTÍAS, INCLUIDAS LAS DE COMERCIABILIDAD, IDONEIDAD PARA UN PROPÓSITO
              PARTICULAR Y NO INFRACCIÓN.
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">15. Limitación de responsabilidad</h3>
            <p className="uppercase font-medium">
              EN LA MEDIDA MÁXIMA PERMITIDA POR LA LEY, ARCHLOGIC SYSTEMS NO SERÁ RESPONSABLE POR DAÑOS
              INDIRECTOS, INCIDENTALES, ESPECIALES, CONSECUENTES O PUNITIVOS. NUESTRA RESPONSABILIDAD TOTAL, POR
              CUALQUIER CONCEPTO, NO EXCEDERÁ EL MONTO PAGADO POR LA SUSCRIPCIÓN CORRESPONDIENTE EN LOS TRES (3)
              MESES ANTERIORES AL HECHO QUE ORIGINE LA RECLAMACIÓN.
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">16. Indemnización</h3>
            <p>
              Usted acepta indemnizar y mantener indemne a Archlogic Systems frente a cualquier reclamo, daño,
              pérdida o gasto derivado de su uso de la plataforma, del incumplimiento de estos Términos o de la
              falsificación de registros, ubicaciones o documentación.
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">17. Terminación</h3>
            <p>
              Podemos suspender o terminar el acceso a BuildTrack en caso de incumplimiento de estos Términos o de
              falta de pago de la suscripción del Cliente. El Cliente puede cancelar su suscripción conforme a las
              condiciones vigentes.
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">18. Ley aplicable y resolución de disputas</h3>
            <p>
              Estos Términos se rigen por las leyes de la República de Guatemala. Cualquier disputa se procurará
              resolver primero mediante negociación de buena fe; de no lograrse, se someterá a los tribunales
              competentes de Huehuetenango, Guatemala, a los que las partes se someten expresamente.
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">19. Cambios a estos términos y contacto</h3>
            <p>
              Podemos actualizar estos Términos periódicamente. Ante cambios materiales, actualizaremos la fecha de
              &quot;Última actualización&quot; y le avisaremos a través de la aplicación. El uso continuado después
              de los cambios constituye su aceptación. Para consultas sobre estos Términos, escríbanos a{' '}
              <a href="mailto:andersonaguirre794@gmail.com" className="text-[#F97316] hover:underline">andersonaguirre794@gmail.com</a>.
            </p>
            <p className="mt-2">
              <strong>Archlogic Systems</strong><br />
              2a calle, zona 3, Huehuetenango, Guatemala
            </p>
          </section>
        </article>

        {/* ==================== ENGLISH VERSION ==================== */}
        <article id="en" className="bg-white rounded-xl border border-gray-200 p-8 space-y-6 text-sm text-[#3D4752] leading-relaxed">
          <div>
            <h2 className="text-2xl font-bold text-[#0A0A0A] mb-1">Terms of Service</h2>
            <p className="text-xs text-[#71717A]">Last updated: July 4, 2026 — v2.0</p>
          </div>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">1. Acceptance and scope</h3>
            <p>
              These Terms of Service (&quot;Terms&quot;) govern the use of BuildTrack —the BuildTrack Mobile
              application and the web panel—, operated by Archlogic Systems, located at 2a calle, zona 3,
              Huehuetenango, Guatemala. By accessing or using BuildTrack, you agree to these Terms. If you do not
              agree, do not use the platform.
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">2. Definitions</h3>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Customer:</strong> the company or organization that subscribes to BuildTrack to manage its personnel.</li>
              <li><strong>Authorized User:</strong> the person (worker, subcontractor, supervisor, or administrator) to whom a Customer grants access to the platform.</li>
              <li><strong>Archlogic:</strong> Archlogic Systems, provider of the platform. It is not the employer of Authorized Users.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">3. Eligibility</h3>
            <p>
              To use BuildTrack, you must be at least 18 years of age and authorized by a Customer. Authorized
              Users access it through accounts created or enabled by their Customer (or via QR code registration).
              BuildTrack is a workforce management tool for the construction industry; it is not intended for
              general consumer use.
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">4. Relationship with your employer</h3>
            <p>
              BuildTrack is a tool that Archlogic makes available to the Customer. Archlogic is not your employer
              nor a party to your employment or commercial relationship. The Customer is solely responsible for
              that relationship, for the accounts it creates, for work assignments, and for the use it makes of
              the platform and its personnel&rsquo;s data.
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">5. Accounts and access</h3>
            <p>
              Authorized Users&rsquo; accounts are created or enabled by the Customer&rsquo;s administrators. Your
              access level and role are determined by your Customer. You are responsible for:
            </p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>Maintaining the confidentiality of your credentials (QR code, PIN, or password).</li>
              <li>All activities that occur under your account.</li>
              <li>Immediately notifying your supervisor or the Customer if you suspect unauthorized access.</li>
            </ul>
            <p className="mt-2">You must not share your credentials or allow another person to clock in or submit reports on your behalf.</p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">6. Subscription and payments</h3>
            <p>
              Access to BuildTrack for a Customer is contracted through a subscription. Payments are processed
              through Paddle, acting as merchant of record. Prices, billing cycles, trial periods, and cancellation
              terms are shown at the time of purchase. Individual Authorized Users do not make any payment to use
              the app. Failure to pay the subscription may suspend the Customer&rsquo;s access and that of its
              Authorized Users.
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">7. Account deletion</h3>
            <p>
              You may request deletion of your account at any time from the app&rsquo;s profile section or by
              writing to{' '}
              <a href="mailto:andersonaguirre794@gmail.com" className="text-[#F97316] hover:underline">andersonaguirre794@gmail.com</a>.
              Upon deletion, your personal data is handled in accordance with the{' '}
              <Link to="/privacy" className="text-[#F97316] hover:underline">Privacy Policy</Link>.
              Certain records (hours, expenses) may be retained as required by the legal and tax obligations
              applicable to your Customer.
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">8. Permitted use</h3>
            <p>BuildTrack is provided solely for legitimate workforce management purposes. You may use it to:</p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>Check in and check out at assigned job sites.</li>
              <li>View your schedule, projects, and tasks.</li>
              <li>Submit expense reports with supporting documentation.</li>
              <li>Submit and track subcontractor invoices.</li>
              <li>View notifications of your assignments.</li>
              <li>Document job site observations and conditions.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">9. Prohibited conduct</h3>
            <p>You agree not to:</p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li><strong>Falsify records:</strong> submit false time entries, fabricated locations, fraudulent expenses, or misleading documentation.</li>
              <li><strong>Manipulate location:</strong> use fake GPS, VPN, or other methods to falsify your location when clocking in.</li>
              <li>Share credentials or use another person&rsquo;s account.</li>
              <li><strong>Reverse engineer:</strong> decompile or attempt to extract the platform&rsquo;s code.</li>
              <li><strong>Circumvent security:</strong> attempt to bypass or interfere with security features.</li>
              <li><strong>Upload harmful content:</strong> files with viruses, malware, or illegal or offensive material.</li>
            </ul>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-3">
              <p className="text-amber-800">
                <strong>Important:</strong> falsifying time, expense, or location records may constitute fraud and
                result in immediate suspension of access, disciplinary action by your employer, and potential legal
                consequences.
              </p>
            </div>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">10. User content</h3>
            <p>
              You and your Customer retain ownership of the photos, documents, and text submitted through
              BuildTrack. By submitting content, you grant Archlogic a non-exclusive, royalty-free, worldwide
              license to host, process, and display that content for the sole purpose of providing the service on
              behalf of your Customer.
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">11. Location services</h3>
            <p>
              BuildTrack uses your device&rsquo;s location to verify your presence at job sites when clocking in.
              Location is collected only when you actively initiate a check-in or check-out; the app does not track
              your location continuously or in the background.
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">12. Intellectual property</h3>
            <p>
              BuildTrack, including its design, code, features, logos, and trademarks, is the exclusive property of
              Archlogic Systems and is protected by applicable intellectual property laws. These Terms grant you
              only a limited, non-exclusive, non-transferable, revocable license to use the platform in accordance
              with them.
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">13. Availability and modifications</h3>
            <p>
              We strive to maintain BuildTrack&rsquo;s availability but do not guarantee uninterrupted or error-free
              operation. We reserve the right to modify, update, or discontinue the platform or any of its features
              at any time.
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">14. Disclaimer of warranties</h3>
            <p className="uppercase font-medium">
              THE PLATFORM IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot;, WITHOUT WARRANTIES OF ANY
              KIND, EXPRESS OR IMPLIED. TO THE MAXIMUM EXTENT PERMITTED BY LAW, ARCHLOGIC SYSTEMS DISCLAIMS ALL
              WARRANTIES, INCLUDING THOSE OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">15. Limitation of liability</h3>
            <p className="uppercase font-medium">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, ARCHLOGIC SYSTEMS SHALL NOT BE LIABLE FOR ANY INDIRECT,
              INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES. OUR TOTAL LIABILITY, ON ANY BASIS, SHALL NOT
              EXCEED THE AMOUNT PAID FOR THE RELEVANT SUBSCRIPTION IN THE THREE (3) MONTHS PRIOR TO THE EVENT GIVING
              RISE TO THE CLAIM.
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">16. Indemnification</h3>
            <p>
              You agree to indemnify and hold harmless Archlogic Systems from any claim, damage, loss, or expense
              arising from your use of the platform, your breach of these Terms, or the falsification of records,
              locations, or documentation.
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">17. Termination</h3>
            <p>
              We may suspend or terminate access to BuildTrack in the event of a breach of these Terms or
              non-payment of the Customer&rsquo;s subscription. The Customer may cancel its subscription in
              accordance with the terms in effect.
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">18. Governing law and dispute resolution</h3>
            <p>
              These Terms are governed by the laws of the Republic of Guatemala. Any dispute shall first be
              attempted to be resolved through good-faith negotiation; failing that, it shall be submitted to the
              competent courts of Huehuetenango, Guatemala, to which the parties expressly submit.
            </p>
          </section>

          <section>
            <h3 className="text-base font-semibold text-[#0A0A0A] mb-2">19. Changes to these terms and contact</h3>
            <p>
              We may update these Terms from time to time. For material changes, we will update the &quot;Last
              updated&quot; date and notify you through the application. Continued use after changes constitutes
              your acceptance. For inquiries about these Terms, write to us at{' '}
              <a href="mailto:andersonaguirre794@gmail.com" className="text-[#F97316] hover:underline">andersonaguirre794@gmail.com</a>.
            </p>
            <p className="mt-2">
              <strong>Archlogic Systems</strong><br />
              2a calle, zona 3, Huehuetenango, Guatemala
            </p>
          </section>
        </article>
      </main>
    </div>
  );
}
