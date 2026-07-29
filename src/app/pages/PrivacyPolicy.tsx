import { LegalDocument, type LegalVersion } from './legal/LegalDocument';

const es: LegalVersion = {
  lang: 'es',
  docTitle: 'Política de Privacidad',
  updatedLabel: 'Última actualización: 4 de julio de 2026 — v2.0',
  tocLabel: 'Contenido',
  meta: [
    { label: 'Proveedor', value: 'Archlogic Systems' },
    { label: 'Producto', value: 'BuildTrack · app «BuildTrack Mobile»' },
    { label: 'Domicilio', value: '2a calle, zona 3, Huehuetenango, Guatemala' },
    { label: 'Ley aplicable', value: 'República de Guatemala' },
    {
      label: 'Contacto',
      value: (
        <a className="ld-a" href="mailto:andersonaguirre794@gmail.com">
          andersonaguirre794@gmail.com
        </a>
      ),
    },
    { label: 'Versión', value: '2.0' },
  ],
  sections: [
    {
      num: 1,
      title: 'Quiénes somos y a quién aplica esta política',
      body: (
        <>
          <p>
            <strong>Archlogic Systems</strong> («Archlogic», «nosotros»), con domicilio en{' '}
            <strong>2a calle, zona 3, Huehuetenango, Guatemala</strong>, desarrolla y opera BuildTrack, una
            plataforma de gestión de fuerza laboral para la construcción que se ofrece como servicio por
            suscripción (SaaS) a empresas («Clientes»). BuildTrack se compone de la aplicación móvil
            BuildTrack Mobile y un panel web de administración. Esta política explica cómo se tratan los datos
            personales dentro de BuildTrack.
          </p>
          <p>
            Como es una plataforma que usan varias empresas a la vez, distingue dos situaciones según quién
            decide sobre los datos, que se detallan en la sección 2.
          </p>
        </>
      ),
    },
    {
      num: 2,
      title: 'Nuestro rol: responsable y encargado del tratamiento',
      body: (
        <>
          <p>El papel de Archlogic frente a sus datos depende de qué datos se trate:</p>
          <ul>
            <li>
              <strong>Datos operativos de los trabajadores</strong> (asistencia, ubicación de fichaje, horas,
              gastos, evidencias fotográficas y facturas): la empresa Cliente que lo emplea o contrata es la
              responsable del tratamiento; ella decide qué se registra y con qué fin, dentro de su relación
              laboral o comercial con usted. Archlogic actúa como encargado del tratamiento, es decir, procesa
              esos datos por cuenta y siguiendo las instrucciones de esa empresa. Si usted es trabajador,
              subcontratista o supervisor, su empleador o contratante es quien controla estos datos.
            </li>
            <li>
              <strong>Datos de la cuenta de administración, de la suscripción y de la plataforma</strong> (datos
              del administrador que contrata BuildTrack, facturación de la suscripción y datos técnicos y de
              seguridad del servicio): respecto a estos, Archlogic es el responsable del tratamiento.
            </li>
          </ul>
          <p>Esta distinción determina a quién dirigirse para ejercer derechos (ver sección 12).</p>
        </>
      ),
    },
    {
      num: 3,
      title: 'Datos que tratamos',
      body: (
        <ul>
          <li>
            <strong>Datos de cuenta:</strong> nombre de usuario, nombre completo, correo electrónico, número
            de teléfono y rol asignado (trabajador, subcontratista, supervisor, administrador, etc.).
          </li>
          <li>
            <strong>Ubicación (GPS):</strong> se usa exclusivamente para verificar la presencia en el sitio de
            obra asignado (geocerca). Se captura únicamente al registrar entrada o salida de la jornada y no se
            rastrea en segundo plano. Se utiliza ubicación precisa para asegurar la exactitud de la verificación.
          </li>
          <li>
            <strong>Cámara y galería:</strong> para capturar recibos de gastos, evidencia fotográfica del
            avance de obra y documentos de facturación. Las imágenes se almacenan en servidores seguros y no
            se comparten con terceros ajenos al servicio.
          </li>
          <li>
            <strong>Registro de jornada:</strong> hora de entrada, hora de salida, proyecto asignado y
            ubicación del registro.
          </li>
          <li>
            <strong>Datos financieros del trabajo:</strong> facturas, montos, conceptos y estados de pago
            relacionados con la actividad del usuario en la plataforma.
          </li>
          <li>
            <strong>Datos de facturación de la suscripción</strong> (solo para el Cliente que contrata): los
            pagos se procesan a través de Paddle; Archlogic no almacena números completos de tarjeta.
          </li>
          <li>
            <strong>Datos técnicos:</strong> dirección IP, tipo de dispositivo, sistema operativo, versión de
            la aplicación e identificadores de diagnóstico, recopilados automáticamente para seguridad y
            diagnóstico.
          </li>
        </ul>
      ),
    },
    {
      num: 4,
      title: 'Para qué usamos la información',
      body: (
        <ul>
          <li>Autenticar y gestionar la cuenta del usuario.</li>
          <li>Registrar y verificar asistencia y horas de trabajo en los sitios de obra.</li>
          <li>Gestionar la asignación de trabajos a subcontratistas y su seguimiento.</li>
          <li>Procesar facturas, gastos y pagos asociados a la actividad laboral.</li>
          <li>Administrar la suscripción del Cliente y su facturación.</li>
          <li>Enviar notificaciones relacionadas con la actividad en la plataforma.</li>
          <li>Mantener la seguridad, prevenir el fraude y mejorar el servicio.</li>
        </ul>
      ),
    },
    {
      num: 5,
      title: 'Base legal del tratamiento',
      body: (
        <ul>
          <li>
            <strong>Ejecución contractual:</strong> el tratamiento es necesario para la relación laboral o
            comercial entre el usuario y su empleador o contratante (asistencia, horas, facturación), y para
            la relación de suscripción entre el Cliente y Archlogic.
          </li>
          <li>
            <strong>Interés legítimo:</strong> seguridad de la plataforma, prevención de fraude y mejora del
            servicio.
          </li>
          <li>
            <strong>Consentimiento:</strong> para el acceso a permisos del dispositivo (ubicación, cámara,
            galería), revocables en cualquier momento desde la configuración del sistema.
          </li>
          <li>
            <strong>Obligación legal:</strong> conservación de registros laborales y fiscales según la ley
            aplicable a cada Cliente.
          </li>
        </ul>
      ),
    },
    {
      num: 6,
      title: 'Proveedores de infraestructura',
      body: (
        <>
          <p>
            BuildTrack se apoya en los siguientes proveedores, que procesan datos por cuenta de Archlogic bajo
            sus propias políticas y acuerdos de tratamiento:
          </p>
          <ul>
            <li>
              <strong>Render:</strong> servidores de aplicación y base de datos.
            </li>
            <li>
              <strong>Supabase:</strong> almacenamiento de archivos e imágenes, sobre infraestructura de Amazon
              Web Services (AWS).
            </li>
            <li>
              <strong>Vercel:</strong> alojamiento del panel web de administración.
            </li>
            <li>
              <strong>Paddle:</strong> procesamiento de pagos de las suscripciones de los Clientes.
            </li>
            <li>
              <strong>Google Play Services:</strong> necesario para el funcionamiento de la app en dispositivos
              Android; puede recopilar información e identificadores del dispositivo.
            </li>
          </ul>
          <p>
            Si se habilita el diagnóstico de errores (Sentry), se procesan datos técnicos mínimos con fines de
            estabilidad; esta función está desactivada salvo indicación contraria.
          </p>
        </>
      ),
    },
    {
      num: 7,
      title: 'Con quién se comparten los datos',
      body: (
        <>
          <p>
            No vendemos, alquilamos ni compartimos datos personales con terceros con fines comerciales o
            publicitarios. Los datos pueden compartirse únicamente con:
          </p>
          <ul>
            <li>La empresa Cliente (empleador o contratante) que administra la cuenta del usuario, en el marco de su relación.</li>
            <li>Los proveedores de infraestructura de la sección 6, que operan bajo acuerdos de confidencialidad y tratamiento de datos.</li>
            <li>Autoridades competentes cuando la ley lo exija.</li>
          </ul>
        </>
      ),
    },
    {
      num: 8,
      title: 'Transferencias internacionales de datos',
      body: (
        <p>
          Los datos pueden almacenarse y procesarse en servidores ubicados fuera de Guatemala y de su país de
          residencia, incluyendo Estados Unidos (Render, AWS/Supabase, Vercel) y las jurisdicciones de
          procesamiento de pagos de Paddle. Estas transferencias se realizan bajo las cláusulas contractuales y
          las políticas de protección de datos de cada proveedor.
        </p>
      ),
    },
    {
      num: 9,
      title: 'Seguridad y aislamiento entre empresas',
      body: (
        <p>
          Los datos se almacenan en servidores seguros con cifrado en tránsito (TLS/HTTPS) y en reposo. Los
          tokens de autenticación se guardan cifrados en el dispositivo. Aplicamos control de acceso basado en
          roles (RBAC) y aislamiento por empresa: cada Cliente accede únicamente a los datos de su propia
          organización y no a los de otros Clientes de la plataforma.
        </p>
      ),
    },
    {
      num: 10,
      title: 'Permisos del dispositivo',
      body: (
        <ul>
          <li>
            <strong>Ubicación precisa (GPS):</strong> verificar la presencia en el sitio de obra al fichar
            (geocerca).
          </li>
          <li>
            <strong>Cámara:</strong> escanear el código QR de inicio de sesión y capturar recibos y evidencia
            fotográfica.
          </li>
          <li>
            <strong>Galería / almacenamiento:</strong> adjuntar imágenes existentes como evidencia o recibos.
          </li>
          <li>
            <strong>Internet:</strong> comunicación con el servidor de la aplicación.
          </li>
        </ul>
      ),
    },
    {
      num: 11,
      title: 'Retención de datos',
      body: (
        <p>
          Los datos personales se conservan mientras la cuenta esté activa. Al darse de baja una cuenta, los
          datos operativos se retienen durante el período que exijan las obligaciones legales, laborales y
          fiscales aplicables a la empresa Cliente, tras lo cual se eliminan de forma segura. La empresa
          Cliente, como responsable, define los plazos aplicables a los datos de su personal.
        </p>
      ),
    },
    {
      num: 12,
      title: 'Sus derechos',
      body: (
        <>
          <p>
            Usted tiene derecho a acceder a sus datos, solicitar su corrección o eliminación, pedir su
            portabilidad en un formato legible por máquina y revocar los permisos del dispositivo en cualquier
            momento.
          </p>
          <ul>
            <li>
              Si sus datos los controla su empresa (asistencia, horas, gastos, evidencias), diríjase primero a
              ella como responsable. Archlogic la asistirá en su calidad de encargado.
            </li>
            <li>
              Para datos de los que Archlogic es responsable (cuenta de administración, facturación de la
              suscripción), escriba a{' '}
              <a className="ld-a" href="mailto:andersonaguirre794@gmail.com">
                andersonaguirre794@gmail.com
              </a>{' '}
              con el asunto «Solicitud de privacidad». Responderemos dentro de un plazo razonable.
            </li>
          </ul>
          <p>La app también permite eliminar la cuenta directamente desde la sección de perfil.</p>
        </>
      ),
    },
    {
      num: 13,
      title: 'Menores de edad',
      body: (
        <p>
          BuildTrack está diseñado exclusivamente para personas mayores de 18 años en el contexto de relaciones
          laborales o comerciales. No recopilamos intencionalmente datos de menores. Si detectamos datos de un
          menor, los eliminaremos de inmediato.
        </p>
      ),
    },
    {
      num: 14,
      title: 'Cookies y tecnologías de seguimiento',
      body: (
        <p>
          La aplicación móvil no utiliza cookies. El panel web usa almacenamiento local del navegador
          únicamente para los tokens de sesión y no emplea cookies de seguimiento, publicidad ni analítica de
          terceros.
        </p>
      ),
    },
    {
      num: 15,
      title: 'Cambios a esta política y contacto',
      body: (
        <p>
          Podemos actualizar esta política; los cambios se publicarán en esta misma página con su fecha y
          versión, y los cambios materiales se avisarán a través de la aplicación. Para cualquier consulta sobre
          privacidad, contáctenos en{' '}
          <a className="ld-a" href="mailto:andersonaguirre794@gmail.com">
            andersonaguirre794@gmail.com
          </a>
          .
        </p>
      ),
    },
  ],
  signature: <>Archlogic Systems — 2a calle, zona 3, Huehuetenango, Guatemala</>,
};

const en: LegalVersion = {
  lang: 'en',
  docTitle: 'Privacy Policy',
  updatedLabel: 'Last updated: July 4, 2026 — v2.0',
  tocLabel: 'Contents',
  meta: [
    { label: 'Provider', value: 'Archlogic Systems' },
    { label: 'Product', value: 'BuildTrack · "BuildTrack Mobile" app' },
    { label: 'Address', value: '2a calle, zona 3, Huehuetenango, Guatemala' },
    { label: 'Governing law', value: 'Republic of Guatemala' },
    {
      label: 'Contact',
      value: (
        <a className="ld-a" href="mailto:andersonaguirre794@gmail.com">
          andersonaguirre794@gmail.com
        </a>
      ),
    },
    { label: 'Version', value: '2.0' },
  ],
  sections: [
    {
      num: 1,
      title: 'Who we are and who this policy applies to',
      body: (
        <>
          <p>
            <strong>Archlogic Systems</strong> ("Archlogic", "we"), located at{' '}
            <strong>2a calle, zona 3, Huehuetenango, Guatemala</strong>, develops and operates BuildTrack, a
            construction workforce management platform offered as a subscription service (SaaS) to companies
            ("Customers"). BuildTrack consists of the BuildTrack Mobile application and a web
            administration panel. This policy explains how personal data is handled within BuildTrack.
          </p>
          <p>
            Because it is a platform used by multiple companies at once, it distinguishes two situations depending
            on who decides about the data, detailed in section 2.
          </p>
        </>
      ),
    },
    {
      num: 2,
      title: 'Our role: controller and processor',
      body: (
        <>
          <p>Archlogic's role regarding your data depends on which data is involved:</p>
          <ul>
            <li>
              <strong>Workers' operational data</strong> (attendance, clock-in location, hours, expenses,
              photographic evidence, and invoices): the Customer company that employs or contracts you is the data
              controller; it decides what is recorded and for what purpose, within its employment or commercial
              relationship with you. Archlogic acts as the data processor, meaning it processes that data on behalf
              of and following the instructions of that company. If you are a worker, subcontractor, or supervisor,
              your employer or contractor is the one who controls this data.
            </li>
            <li>
              <strong>Administration account, subscription, and platform data</strong> (data of the administrator
              who subscribes to BuildTrack, subscription billing, and technical and security data of the service):
              with respect to these, Archlogic is the data controller.
            </li>
          </ul>
          <p>This distinction determines whom to contact to exercise rights (see section 12).</p>
        </>
      ),
    },
    {
      num: 3,
      title: 'Data we collect',
      body: (
        <ul>
          <li>
            <strong>Account data:</strong> username, full name, email address, phone number, and assigned role
            (worker, subcontractor, supervisor, administrator, etc.).
          </li>
          <li>
            <strong>Location (GPS):</strong> used exclusively to verify presence at the assigned construction
            site (geofence). It is captured only when clocking in or out and is not tracked in the background.
            Precise location is used to ensure verification accuracy.
          </li>
          <li>
            <strong>Camera and gallery:</strong> to capture expense receipts, photographic evidence of
            construction progress, and invoicing documents. Images are stored on secure servers and are not
            shared with third parties outside the service.
          </li>
          <li>
            <strong>Work records:</strong> clock-in time, clock-out time, assigned project, and check-in
            location.
          </li>
          <li>
            <strong>Work-related financial data:</strong> invoices, amounts, descriptions, and payment statuses
            related to the user's activity on the platform.
          </li>
          <li>
            <strong>Subscription billing data</strong> (only for the subscribing Customer): payments are
            processed through Paddle; Archlogic does not store full card numbers.
          </li>
          <li>
            <strong>Technical data:</strong> IP address, device type, operating system, app version, and
            diagnostic identifiers, collected automatically for security and diagnostics.
          </li>
        </ul>
      ),
    },
    {
      num: 4,
      title: 'How we use the information',
      body: (
        <ul>
          <li>Authenticate and manage the user's account.</li>
          <li>Record and verify attendance and work hours at construction sites.</li>
          <li>Manage work assignments to subcontractors and track their progress.</li>
          <li>Process invoices, expenses, and payments associated with work activity.</li>
          <li>Administer the Customer's subscription and billing.</li>
          <li>Send notifications related to platform activity.</li>
          <li>Maintain security, prevent fraud, and improve the service.</li>
        </ul>
      ),
    },
    {
      num: 5,
      title: 'Legal basis for processing',
      body: (
        <ul>
          <li>
            <strong>Contractual performance:</strong> processing is necessary for the employment or commercial
            relationship between the user and their employer or contractor (attendance, hours, invoicing), and
            for the subscription relationship between the Customer and Archlogic.
          </li>
          <li>
            <strong>Legitimate interest:</strong> platform security, fraud prevention, and service improvement.
          </li>
          <li>
            <strong>Consent:</strong> for access to device permissions (location, camera, gallery), revocable at
            any time from system settings.
          </li>
          <li>
            <strong>Legal obligation:</strong> retention of labor and tax records as required by the law
            applicable to each Customer.
          </li>
        </ul>
      ),
    },
    {
      num: 6,
      title: 'Infrastructure providers',
      body: (
        <>
          <p>
            BuildTrack relies on the following providers, which process data on Archlogic's behalf under
            their own policies and data processing agreements:
          </p>
          <ul>
            <li>
              <strong>Render:</strong> application and database servers.
            </li>
            <li>
              <strong>Supabase:</strong> file and image storage, on Amazon Web Services (AWS) infrastructure.
            </li>
            <li>
              <strong>Vercel:</strong> hosting for the web administration panel.
            </li>
            <li>
              <strong>Paddle:</strong> payment processing for Customers' subscriptions.
            </li>
            <li>
              <strong>Google Play Services:</strong> required for the app to operate on Android devices; may
              collect device information and identifiers.
            </li>
          </ul>
          <p>
            If error diagnostics (Sentry) are enabled, minimal technical data is processed for stability purposes;
            this feature is disabled unless otherwise indicated.
          </p>
        </>
      ),
    },
    {
      num: 7,
      title: 'Who we share data with',
      body: (
        <>
          <p>
            We do not sell, rent, or share personal data with third parties for commercial or advertising
            purposes. Data may be shared only with:
          </p>
          <ul>
            <li>The Customer company (employer or contractor) that administers the user's account, within their relationship.</li>
            <li>The infrastructure providers listed in section 6, operating under confidentiality and data processing agreements.</li>
            <li>Competent authorities when required by law.</li>
          </ul>
        </>
      ),
    },
    {
      num: 8,
      title: 'International data transfers',
      body: (
        <p>
          Data may be stored and processed on servers located outside Guatemala and your country of residence,
          including the United States (Render, AWS/Supabase, Vercel) and Paddle's payment processing
          jurisdictions. These transfers are carried out under each provider's contractual clauses and
          data protection policies.
        </p>
      ),
    },
    {
      num: 9,
      title: 'Security and isolation between companies',
      body: (
        <p>
          Data is stored on secure servers with encryption in transit (TLS/HTTPS) and at rest. Authentication
          tokens are stored encrypted on the device. We apply role-based access control (RBAC) and per-company
          isolation: each Customer accesses only the data of its own organization and not that of other
          Customers on the platform.
        </p>
      ),
    },
    {
      num: 10,
      title: 'Device permissions',
      body: (
        <ul>
          <li>
            <strong>Precise location (GPS):</strong> verify presence at the construction site when clocking in
            (geofence).
          </li>
          <li>
            <strong>Camera:</strong> scan the sign-in QR code and capture receipts and photographic evidence.
          </li>
          <li>
            <strong>Gallery / storage:</strong> attach existing images as evidence or receipts.
          </li>
          <li>
            <strong>Internet:</strong> communication with the application server.
          </li>
        </ul>
      ),
    },
    {
      num: 11,
      title: 'Data retention',
      body: (
        <p>
          Personal data is retained while the account is active. Upon account deactivation, operational data is
          retained for the period required by the legal, labor, and tax obligations applicable to the Customer
          company, after which it is securely deleted. The Customer company, as controller, defines the
          applicable retention periods for its personnel's data.
        </p>
      ),
    },
    {
      num: 12,
      title: 'Your rights',
      body: (
        <>
          <p>
            You have the right to access your data, request its correction or deletion, request its portability in
            a machine-readable format, and revoke device permissions at any time.
          </p>
          <ul>
            <li>
              If your data is controlled by your company (attendance, hours, expenses, evidence), contact it first
              as the controller. Archlogic will assist it in its capacity as processor.
            </li>
            <li>
              For data of which Archlogic is the controller (administration account, subscription billing), email{' '}
              <a className="ld-a" href="mailto:andersonaguirre794@gmail.com">
                andersonaguirre794@gmail.com
              </a>{' '}
              with the subject "Privacy request". We will respond within a reasonable timeframe.
            </li>
          </ul>
          <p>The app also lets you delete your account directly from the profile section.</p>
        </>
      ),
    },
    {
      num: 13,
      title: "Children's privacy",
      body: (
        <p>
          BuildTrack is designed exclusively for people aged 18 and over in the context of employment or
          commercial relationships. We do not knowingly collect data from minors. If we detect a minor's
          data, we will delete it immediately.
        </p>
      ),
    },
    {
      num: 14,
      title: 'Cookies and tracking technologies',
      body: (
        <p>
          The mobile application does not use cookies. The web panel uses browser local storage solely for
          session tokens and does not employ tracking cookies, advertising, or third-party analytics.
        </p>
      ),
    },
    {
      num: 15,
      title: 'Changes to this policy and contact',
      body: (
        <p>
          We may update this policy; changes will be posted on this page with their date and version, and
          material changes will be announced through the application. For any privacy inquiries, contact us at{' '}
          <a className="ld-a" href="mailto:andersonaguirre794@gmail.com">
            andersonaguirre794@gmail.com
          </a>
          .
        </p>
      ),
    },
  ],
  signature: <>Archlogic Systems — 2a calle, zona 3, Huehuetenango, Guatemala</>,
};

export function PrivacyPolicy() {
  return (
    <LegalDocument
      idPrefix="priv"
      backHref="/"
      es={es}
      en={en}
      labels={{ spanish: 'Español', english: 'English', back: '← BuildTrack', kicker: 'Legal' }}
      footer={<>© 2026 Archlogic Systems · BuildTrack — 2a calle, zona 3, Huehuetenango, Guatemala</>}
    />
  );
}
