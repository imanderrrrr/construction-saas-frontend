import { Link } from 'react-router';
import {
  LegalDocument,
  type LegalSection,
  type LegalVersion,
} from './legal/LegalDocument';

const CONTACT = (
  <a className="ld-a" href="mailto:andersonaguirre794@gmail.com">
    andersonaguirre794@gmail.com
  </a>
);

const esSections: LegalSection[] = [
  {
    num: 1,
    title: 'Aceptación y alcance',
    body: (
      <p>
        Estos Términos de Servicio («Términos») regulan el uso de BuildTrack —la aplicación
        móvil BuildTrack Mobile y el panel web—, operada por Archlogic Systems, con domicilio en
        2a calle, zona 3, Huehuetenango, Guatemala. Al acceder o usar BuildTrack, usted acepta estos
        Términos. Si no está de acuerdo, no use la plataforma.
      </p>
    ),
  },
  {
    num: 2,
    title: 'Definiciones',
    body: (
      <ul>
        <li><strong>Cliente:</strong> la empresa u organización que contrata una suscripción a BuildTrack para gestionar a su personal.</li>
        <li><strong>Usuario Autorizado:</strong> la persona (trabajador, subcontratista, supervisor o administrador) a la que un Cliente concede acceso a la plataforma.</li>
        <li><strong>Archlogic:</strong> Archlogic Systems, proveedor de la plataforma. No es empleador de los Usuarios Autorizados.</li>
      </ul>
    ),
  },
  {
    num: 3,
    title: 'Elegibilidad',
    body: (
      <p>
        Para usar BuildTrack, usted debe ser mayor de 18 años y estar autorizado por un Cliente. Los
        Usuarios Autorizados acceden mediante cuentas creadas o habilitadas por su Cliente (o mediante
        registro por código QR). BuildTrack es una herramienta de gestión laboral para la construcción;
        no está destinada al uso general del consumidor.
      </p>
    ),
  },
  {
    num: 4,
    title: 'Relación con su empleador',
    body: (
      <p>
        BuildTrack es una herramienta que Archlogic pone a disposición del Cliente. Archlogic no es su
        empleador ni parte de su relación laboral o comercial. El Cliente es el único responsable de esa
        relación, de las cuentas que crea, de las asignaciones de trabajo y del uso que da a la plataforma
        y a los datos de su personal.
      </p>
    ),
  },
  {
    num: 5,
    title: 'Cuentas y acceso',
    body: (
      <>
        <p>
          Las cuentas de los Usuarios Autorizados las crean o habilitan los administradores del Cliente. Su
          nivel de acceso y rol los determina su Cliente. Usted es responsable de:
        </p>
        <ul>
          <li>Mantener la confidencialidad de sus credenciales (código QR, PIN o contraseña).</li>
          <li>Todas las actividades que ocurran bajo su cuenta.</li>
          <li>Notificar de inmediato a su supervisor o al Cliente si sospecha de acceso no autorizado.</li>
        </ul>
        <p>No debe compartir sus credenciales ni permitir que otra persona fiche o envíe reportes en su nombre.</p>
      </>
    ),
  },
  {
    num: 6,
    title: 'Suscripción y pagos',
    body: (
      <p>
        El acceso a BuildTrack para un Cliente se contrata mediante una suscripción. Los pagos se procesan
        a través de Paddle, que actúa como comerciante registrado. Los precios, ciclos de facturación,
        períodos de prueba y condiciones de cancelación se muestran al momento de la contratación. Los
        Usuarios Autorizados individuales no realizan ningún pago por usar la app. La falta de pago de la
        suscripción puede suspender el acceso del Cliente y de sus Usuarios Autorizados.
      </p>
    ),
  },
  {
    num: 7,
    title: 'Eliminación de cuenta',
    body: (
      <p>
        Usted puede solicitar la eliminación de su cuenta en cualquier momento desde la sección de perfil
        de la app o escribiendo a {CONTACT}.
        Al eliminarla, sus datos personales se tratan conforme a la{' '}
        <Link className="ld-a" to="/privacy">Política de Privacidad</Link>.
        Ciertos registros (horas, gastos) pueden conservarse según lo exijan las obligaciones legales y
        fiscales aplicables a su Cliente.
      </p>
    ),
  },
  {
    num: 8,
    title: 'Uso permitido',
    body: (
      <>
        <p>BuildTrack se ofrece exclusivamente para fines legítimos de gestión laboral. Puede usarla para:</p>
        <ul>
          <li>Registrar entrada y salida en los sitios de trabajo asignados.</li>
          <li>Ver su horario, proyectos y tareas.</li>
          <li>Enviar reportes de gastos con documentación de respaldo.</li>
          <li>Enviar y dar seguimiento a facturas de subcontratistas.</li>
          <li>Ver notificaciones de sus asignaciones.</li>
          <li>Documentar observaciones y condiciones del sitio de trabajo.</li>
        </ul>
      </>
    ),
  },
  {
    num: 9,
    title: 'Conducta prohibida',
    body: (
      <>
        <p>Usted acepta no:</p>
        <ul>
          <li><strong>Falsificar registros:</strong> enviar marcas de tiempo falsas, ubicaciones fabricadas, gastos fraudulentos o documentación engañosa.</li>
          <li><strong>Manipular la ubicación:</strong> usar GPS falso, VPN u otros métodos para falsear su ubicación al fichar.</li>
          <li>Compartir credenciales o usar la cuenta de otra persona.</li>
          <li><strong>Realizar ingeniería inversa:</strong> descompilar o intentar extraer el código de la plataforma.</li>
          <li><strong>Eludir la seguridad:</strong> intentar sortear o interferir con las funciones de seguridad.</li>
          <li><strong>Subir contenido dañino:</strong> archivos con virus, malware o material ilegal u ofensivo.</li>
        </ul>
        <p>
          <strong>Importante:</strong> falsificar registros de tiempo, gastos o ubicación puede constituir
          fraude y derivar en la suspensión inmediata del acceso, acciones disciplinarias por parte de su
          empleador y posibles consecuencias legales.
        </p>
      </>
    ),
  },
  {
    num: 10,
    title: 'Contenido del usuario',
    body: (
      <p>
        Usted y su Cliente conservan la propiedad de las fotos, documentos y textos enviados a través de
        BuildTrack. Al enviar contenido, usted otorga a Archlogic una licencia no exclusiva, libre de
        regalías y mundial para alojar, procesar y mostrar dicho contenido con el único fin de prestar el
        servicio por cuenta de su Cliente.
      </p>
    ),
  },
  {
    num: 11,
    title: 'Servicios de ubicación',
    body: (
      <p>
        BuildTrack usa la ubicación de su dispositivo para verificar su presencia en los sitios de trabajo
        al fichar. La ubicación se recopila únicamente cuando usted inicia activamente una entrada o salida;
        la app no rastrea su ubicación de forma continua ni en segundo plano.
      </p>
    ),
  },
  {
    num: 12,
    title: 'Propiedad intelectual',
    body: (
      <p>
        BuildTrack, incluyendo su diseño, código, funciones, logotipos y marcas, es propiedad exclusiva de
        Archlogic Systems y está protegida por las leyes de propiedad intelectual aplicables. Estos Términos
        le otorgan únicamente una licencia limitada, no exclusiva, intransferible y revocable para usar la
        plataforma conforme a ellos.
      </p>
    ),
  },
  {
    num: 13,
    title: 'Disponibilidad y modificaciones',
    body: (
      <p>
        Nos esforzamos por mantener la disponibilidad de BuildTrack, pero no garantizamos un funcionamiento
        ininterrumpido o libre de errores. Nos reservamos el derecho de modificar, actualizar o descontinuar
        la plataforma o cualquiera de sus funciones en cualquier momento.
      </p>
    ),
  },
  {
    num: 14,
    title: 'Exención de garantías',
    body: (
      <p className="ld-caps">
        LA PLATAFORMA SE PROPORCIONA «TAL CUAL» Y «SEGÚN DISPONIBILIDAD», SIN GARANTÍAS
        DE NINGÚN TIPO, EXPRESAS O IMPLÍCITAS. EN LA MEDIDA MÁXIMA PERMITIDA POR LA LEY, ARCHLOGIC SYSTEMS
        RENUNCIA A TODAS LAS GARANTÍAS, INCLUIDAS LAS DE COMERCIABILIDAD, IDONEIDAD PARA UN PROPÓSITO
        PARTICULAR Y NO INFRACCIÓN.
      </p>
    ),
  },
  {
    num: 15,
    title: 'Limitación de responsabilidad',
    body: (
      <p className="ld-caps">
        EN LA MEDIDA MÁXIMA PERMITIDA POR LA LEY, ARCHLOGIC SYSTEMS NO SERÁ RESPONSABLE POR DAÑOS
        INDIRECTOS, INCIDENTALES, ESPECIALES, CONSECUENTES O PUNITIVOS. NUESTRA RESPONSABILIDAD TOTAL, POR
        CUALQUIER CONCEPTO, NO EXCEDERÁ EL MONTO PAGADO POR LA SUSCRIPCIÓN CORRESPONDIENTE EN LOS TRES (3)
        MESES ANTERIORES AL HECHO QUE ORIGINE LA RECLAMACIÓN.
      </p>
    ),
  },
  {
    num: 16,
    title: 'Indemnización',
    body: (
      <p>
        Usted acepta indemnizar y mantener indemne a Archlogic Systems frente a cualquier reclamo, daño,
        pérdida o gasto derivado de su uso de la plataforma, del incumplimiento de estos Términos o de la
        falsificación de registros, ubicaciones o documentación.
      </p>
    ),
  },
  {
    num: 17,
    title: 'Terminación',
    body: (
      <p>
        Podemos suspender o terminar el acceso a BuildTrack en caso de incumplimiento de estos Términos o de
        falta de pago de la suscripción del Cliente. El Cliente puede cancelar su suscripción conforme a las
        condiciones vigentes.
      </p>
    ),
  },
  {
    num: 18,
    title: 'Ley aplicable y resolución de disputas',
    body: (
      <p>
        Estos Términos se rigen por las leyes de la República de Guatemala. Cualquier disputa se procurará
        resolver primero mediante negociación de buena fe; de no lograrse, se someterá a los tribunales
        competentes de Huehuetenango, Guatemala, a los que las partes se someten expresamente.
      </p>
    ),
  },
  {
    num: 19,
    title: 'Cambios a estos términos y contacto',
    body: (
      <p>
        Podemos actualizar estos Términos periódicamente. Ante cambios materiales, actualizaremos la fecha de
        «Última actualización» y le avisaremos a través de la aplicación. El uso continuado después
        de los cambios constituye su aceptación. Para consultas sobre estos Términos, escríbanos a {CONTACT}.
      </p>
    ),
  },
];

const enSections: LegalSection[] = [
  {
    num: 1,
    title: 'Acceptance and scope',
    body: (
      <p>
        These Terms of Service («Terms») govern the use of BuildTrack —the BuildTrack Mobile
        application and the web panel—, operated by Archlogic Systems, located at 2a calle, zona 3,
        Huehuetenango, Guatemala. By accessing or using BuildTrack, you agree to these Terms. If you do not
        agree, do not use the platform.
      </p>
    ),
  },
  {
    num: 2,
    title: 'Definitions',
    body: (
      <ul>
        <li><strong>Customer:</strong> the company or organization that subscribes to BuildTrack to manage its personnel.</li>
        <li><strong>Authorized User:</strong> the person (worker, subcontractor, supervisor, or administrator) to whom a Customer grants access to the platform.</li>
        <li><strong>Archlogic:</strong> Archlogic Systems, provider of the platform. It is not the employer of Authorized Users.</li>
      </ul>
    ),
  },
  {
    num: 3,
    title: 'Eligibility',
    body: (
      <p>
        To use BuildTrack, you must be at least 18 years of age and authorized by a Customer. Authorized
        Users access it through accounts created or enabled by their Customer (or via QR code registration).
        BuildTrack is a workforce management tool for the construction industry; it is not intended for
        general consumer use.
      </p>
    ),
  },
  {
    num: 4,
    title: 'Relationship with your employer',
    body: (
      <p>
        BuildTrack is a tool that Archlogic makes available to the Customer. Archlogic is not your employer
        nor a party to your employment or commercial relationship. The Customer is solely responsible for
        that relationship, for the accounts it creates, for work assignments, and for the use it makes of
        the platform and its personnel’s data.
      </p>
    ),
  },
  {
    num: 5,
    title: 'Accounts and access',
    body: (
      <>
        <p>
          Authorized Users’ accounts are created or enabled by the Customer’s administrators. Your
          access level and role are determined by your Customer. You are responsible for:
        </p>
        <ul>
          <li>Maintaining the confidentiality of your credentials (QR code, PIN, or password).</li>
          <li>All activities that occur under your account.</li>
          <li>Immediately notifying your supervisor or the Customer if you suspect unauthorized access.</li>
        </ul>
        <p>You must not share your credentials or allow another person to clock in or submit reports on your behalf.</p>
      </>
    ),
  },
  {
    num: 6,
    title: 'Subscription and payments',
    body: (
      <p>
        Access to BuildTrack for a Customer is contracted through a subscription. Payments are processed
        through Paddle, acting as merchant of record. Prices, billing cycles, trial periods, and cancellation
        terms are shown at the time of purchase. Individual Authorized Users do not make any payment to use
        the app. Failure to pay the subscription may suspend the Customer’s access and that of its
        Authorized Users.
      </p>
    ),
  },
  {
    num: 7,
    title: 'Account deletion',
    body: (
      <p>
        You may request deletion of your account at any time from the app’s profile section or by
        writing to {CONTACT}.
        Upon deletion, your personal data is handled in accordance with the{' '}
        <Link className="ld-a" to="/privacy">Privacy Policy</Link>.
        Certain records (hours, expenses) may be retained as required by the legal and tax obligations
        applicable to your Customer.
      </p>
    ),
  },
  {
    num: 8,
    title: 'Permitted use',
    body: (
      <>
        <p>BuildTrack is provided solely for legitimate workforce management purposes. You may use it to:</p>
        <ul>
          <li>Check in and check out at assigned job sites.</li>
          <li>View your schedule, projects, and tasks.</li>
          <li>Submit expense reports with supporting documentation.</li>
          <li>Submit and track subcontractor invoices.</li>
          <li>View notifications of your assignments.</li>
          <li>Document job site observations and conditions.</li>
        </ul>
      </>
    ),
  },
  {
    num: 9,
    title: 'Prohibited conduct',
    body: (
      <>
        <p>You agree not to:</p>
        <ul>
          <li><strong>Falsify records:</strong> submit false time entries, fabricated locations, fraudulent expenses, or misleading documentation.</li>
          <li><strong>Manipulate location:</strong> use fake GPS, VPN, or other methods to falsify your location when clocking in.</li>
          <li>Share credentials or use another person’s account.</li>
          <li><strong>Reverse engineer:</strong> decompile or attempt to extract the platform’s code.</li>
          <li><strong>Circumvent security:</strong> attempt to bypass or interfere with security features.</li>
          <li><strong>Upload harmful content:</strong> files with viruses, malware, or illegal or offensive material.</li>
        </ul>
        <p>
          <strong>Important:</strong> falsifying time, expense, or location records may constitute fraud and
          result in immediate suspension of access, disciplinary action by your employer, and potential legal
          consequences.
        </p>
      </>
    ),
  },
  {
    num: 10,
    title: 'User content',
    body: (
      <p>
        You and your Customer retain ownership of the photos, documents, and text submitted through
        BuildTrack. By submitting content, you grant Archlogic a non-exclusive, royalty-free, worldwide
        license to host, process, and display that content for the sole purpose of providing the service on
        behalf of your Customer.
      </p>
    ),
  },
  {
    num: 11,
    title: 'Location services',
    body: (
      <p>
        BuildTrack uses your device’s location to verify your presence at job sites when clocking in.
        Location is collected only when you actively initiate a check-in or check-out; the app does not track
        your location continuously or in the background.
      </p>
    ),
  },
  {
    num: 12,
    title: 'Intellectual property',
    body: (
      <p>
        BuildTrack, including its design, code, features, logos, and trademarks, is the exclusive property of
        Archlogic Systems and is protected by applicable intellectual property laws. These Terms grant you
        only a limited, non-exclusive, non-transferable, revocable license to use the platform in accordance
        with them.
      </p>
    ),
  },
  {
    num: 13,
    title: 'Availability and modifications',
    body: (
      <p>
        We strive to maintain BuildTrack’s availability but do not guarantee uninterrupted or error-free
        operation. We reserve the right to modify, update, or discontinue the platform or any of its features
        at any time.
      </p>
    ),
  },
  {
    num: 14,
    title: 'Disclaimer of warranties',
    body: (
      <p className="ld-caps">
        THE PLATFORM IS PROVIDED «AS IS» AND «AS AVAILABLE», WITHOUT WARRANTIES OF ANY
        KIND, EXPRESS OR IMPLIED. TO THE MAXIMUM EXTENT PERMITTED BY LAW, ARCHLOGIC SYSTEMS DISCLAIMS ALL
        WARRANTIES, INCLUDING THOSE OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
      </p>
    ),
  },
  {
    num: 15,
    title: 'Limitation of liability',
    body: (
      <p className="ld-caps">
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, ARCHLOGIC SYSTEMS SHALL NOT BE LIABLE FOR ANY INDIRECT,
        INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES. OUR TOTAL LIABILITY, ON ANY BASIS, SHALL NOT
        EXCEED THE AMOUNT PAID FOR THE RELEVANT SUBSCRIPTION IN THE THREE (3) MONTHS PRIOR TO THE EVENT GIVING
        RISE TO THE CLAIM.
      </p>
    ),
  },
  {
    num: 16,
    title: 'Indemnification',
    body: (
      <p>
        You agree to indemnify and hold harmless Archlogic Systems from any claim, damage, loss, or expense
        arising from your use of the platform, your breach of these Terms, or the falsification of records,
        locations, or documentation.
      </p>
    ),
  },
  {
    num: 17,
    title: 'Termination',
    body: (
      <p>
        We may suspend or terminate access to BuildTrack in the event of a breach of these Terms or
        non-payment of the Customer’s subscription. The Customer may cancel its subscription in
        accordance with the terms in effect.
      </p>
    ),
  },
  {
    num: 18,
    title: 'Governing law and dispute resolution',
    body: (
      <p>
        These Terms are governed by the laws of the Republic of Guatemala. Any dispute shall first be
        attempted to be resolved through good-faith negotiation; failing that, it shall be submitted to the
        competent courts of Huehuetenango, Guatemala, to which the parties expressly submit.
      </p>
    ),
  },
  {
    num: 19,
    title: 'Changes to these terms and contact',
    body: (
      <p>
        We may update these Terms from time to time. For material changes, we will update the «Last
        updated» date and notify you through the application. Continued use after changes constitutes
        your acceptance. For inquiries about these Terms, write to us at {CONTACT}.
      </p>
    ),
  },
];

const es: LegalVersion = {
  lang: 'es',
  docTitle: 'Términos de Servicio',
  updatedLabel: 'Última actualización: 4 de julio de 2026 — v2.0',
  tocLabel: 'Contenido',
  meta: [
    { label: 'Proveedor', value: 'Archlogic Systems' },
    { label: 'Producto', value: 'BuildTrack · app «BuildTrack Mobile»' },
    { label: 'Domicilio', value: '2a calle, zona 3, Huehuetenango, Guatemala' },
    { label: 'Ley aplicable', value: 'República de Guatemala' },
    { label: 'Contacto', value: CONTACT },
    { label: 'Versión', value: '2.0' },
  ],
  sections: esSections,
  signature: <>Archlogic Systems — 2a calle, zona 3, Huehuetenango, Guatemala</>,
};

const en: LegalVersion = {
  lang: 'en',
  docTitle: 'Terms of Service',
  updatedLabel: 'Last updated: July 4, 2026 — v2.0',
  tocLabel: 'Contents',
  meta: [
    { label: 'Provider', value: 'Archlogic Systems' },
    { label: 'Product', value: 'BuildTrack · "BuildTrack Mobile" app' },
    { label: 'Address', value: '2a calle, zona 3, Huehuetenango, Guatemala' },
    { label: 'Governing law', value: 'Republic of Guatemala' },
    { label: 'Contact', value: CONTACT },
    { label: 'Version', value: '2.0' },
  ],
  sections: enSections,
  signature: <>Archlogic Systems — 2a calle, zona 3, Huehuetenango, Guatemala</>,
};

export function TermsOfService() {
  return (
    <LegalDocument
      idPrefix="terms"
      backHref="/"
      es={es}
      en={en}
      labels={{ spanish: 'Español', english: 'English', back: '← BuildTrack', kicker: 'Legal' }}
      footer={<>© 2026 Archlogic Systems · BuildTrack — 2a calle, zona 3, Huehuetenango, Guatemala</>}
    />
  );
}
