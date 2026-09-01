import { Link } from 'react-router';
import {
  LegalDocument,
  type LegalSection,
  type LegalVersion,
} from './legal/LegalDocument';
import { SUPPORT_EMAIL, supportMailto } from '../lib/contact';

const CONTACT = (
  <a className="ld-a" href={supportMailto()}>
    {SUPPORT_EMAIL}
  </a>
);

const esSections: LegalSection[] = [
  {
    num: 1,
    title: 'Información de contacto',
    body: (
      <>
        <p>
          Si necesitas ayuda con BuildTrack —la aplicación móvil BuildTrack Mobile o el panel web de
          administración—, puedes comunicarte con <strong>Archlogic Systems</strong>, el proveedor de la
          plataforma:
        </p>
        <ul>
          <li><strong>Proveedor:</strong> Archlogic Systems</li>
          <li><strong>Domicilio:</strong> 2a calle, zona 3, Huehuetenango, Guatemala</li>
          <li><strong>Correo de soporte:</strong> {CONTACT}</li>
          <li><strong>Tiempo de respuesta:</strong> 2 días hábiles</li>
        </ul>
        <p>
          Si eres trabajador, subcontratista o supervisor, tu empleador o contratante administra tu cuenta y
          tus datos de trabajo dentro de BuildTrack. Para altas, bajas, contraseñas, horarios y asignaciones
          de proyecto, comunícate primero con el administrador de tu empresa.
        </p>
      </>
    ),
  },
  {
    num: 2,
    title: 'Cómo solicitar ayuda',
    body: (
      <>
        <p>Para reportar un problema o solicitar asistencia:</p>
        <ol>
          <li>Envía un correo a {CONTACT}</li>
          <li>
            Incluye en el <strong>asunto</strong> una breve descripción del problema (ejemplo: «No puedo
            registrar entrada»)
          </li>
          <li>
            En el cuerpo del correo, incluye:
            <ul>
              <li>Tu <strong>nombre de usuario</strong></li>
              <li>El <strong>nombre de tu empresa</strong> dentro de BuildTrack</li>
              <li>Tu <strong>dispositivo y sistema operativo</strong> (ejemplo: iPhone 15, iOS 17.4)</li>
              <li>Una <strong>descripción detallada</strong> del problema</li>
              <li>Capturas de pantalla si es posible</li>
            </ul>
          </li>
          <li>Responderemos en un plazo de <strong>2 días hábiles</strong></li>
        </ol>
      </>
    ),
  },
  {
    num: 3,
    title: 'Preguntas frecuentes',
    body: (
      <>
        <p><strong>¿Cómo restablezco mi contraseña?</strong></p>
        <p>
          Las contraseñas son administradas por tu empleador. Contacta al administrador o supervisor de tu
          empresa para solicitar un restablecimiento de contraseña.
        </p>

        <p><strong>¿Cómo elimino mi cuenta?</strong></p>
        <p>
          Puedes solicitar la eliminación de tu cuenta desde <strong>Perfil › Eliminar cuenta</strong> dentro
          de la app, o enviando un correo a {CONTACT}. Tu cuenta se desactiva de inmediato y ya no podrás
          iniciar sesión con tu contraseña, tu PIN ni tu código QR. Durante los 30 días siguientes solo un
          administrador de tu empresa puede reactivarla; pasado ese plazo, la eliminación es permanente e
          irreversible.
        </p>

        <p><strong>¿Por qué la app no detecta mi ubicación?</strong></p>
        <p>
          Asegúrate de que los permisos de ubicación estén habilitados en la configuración de tu dispositivo.
          La detección GPS funciona mejor al aire libre. Si el problema persiste, reinicia la app e inténtalo
          de nuevo.
        </p>

        <p><strong>No puedo registrar entrada o salida, ¿qué hago?</strong></p>
        <p>
          Verifica tu conexión a internet y que los permisos de ubicación estén activados. Si continúas con
          problemas, contacta a tu supervisor o escríbenos al correo de soporte.
        </p>

        <p><strong>¿Cómo envío un reporte de gastos?</strong></p>
        <p>
          Navega a la sección de <strong>Gastos</strong> desde el menú principal. Completa el formulario,
          adjunta una foto del recibo usando la cámara o la galería, y envíalo para revisión de tu supervisor.
        </p>

        <p><strong>¿Con quién me comunico sobre mi horario de trabajo?</strong></p>
        <p>
          Los horarios son gestionados por tu supervisor o administrador. Comunícate directamente con ellos
          para consultas sobre asignaciones de proyectos y horas de trabajo.
        </p>
      </>
    ),
  },
  {
    num: 4,
    title: 'Documentos relacionados',
    body: (
      <ul>
        <li><Link className="ld-a" to="/privacy">Política de Privacidad</Link></li>
        <li><Link className="ld-a" to="/terms">Términos de Servicio</Link></li>
      </ul>
    ),
  },
];

const enSections: LegalSection[] = [
  {
    num: 1,
    title: 'Contact information',
    body: (
      <>
        <p>
          If you need help with BuildTrack —the BuildTrack Mobile app or the web administration panel— you
          can reach <strong>Archlogic Systems</strong>, the provider of the platform:
        </p>
        <ul>
          <li><strong>Provider:</strong> Archlogic Systems</li>
          <li><strong>Address:</strong> 2a calle, zona 3, Huehuetenango, Guatemala</li>
          <li><strong>Support email:</strong> {CONTACT}</li>
          <li><strong>Response time:</strong> 2 business days</li>
        </ul>
        <p>
          If you are a worker, subcontractor, or supervisor, your employer or contracting company manages
          your account and your work data inside BuildTrack. For account creation, removal, passwords,
          schedules, and project assignments, contact your company&apos;s administrator first.
        </p>
      </>
    ),
  },
  {
    num: 2,
    title: 'How to request help',
    body: (
      <>
        <p>To report an issue or request assistance:</p>
        <ol>
          <li>Send an email to {CONTACT}</li>
          <li>
            Include a brief description of the issue in the <strong>subject line</strong> (e.g., &quot;Cannot
            clock in&quot;)
          </li>
          <li>
            In the body of the email, include:
            <ul>
              <li>Your <strong>username</strong></li>
              <li>Your <strong>company name</strong> within BuildTrack</li>
              <li>Your <strong>device and operating system</strong> (e.g., iPhone 15, iOS 17.4)</li>
              <li>A <strong>detailed description</strong> of the issue</li>
              <li>Screenshots if possible</li>
            </ul>
          </li>
          <li>We will respond within <strong>2 business days</strong></li>
        </ol>
      </>
    ),
  },
  {
    num: 3,
    title: 'Frequently asked questions',
    body: (
      <>
        <p><strong>How do I reset my password?</strong></p>
        <p>
          Passwords are managed by your employer. Contact your company&apos;s administrator or supervisor to
          request a password reset.
        </p>

        <p><strong>How do I delete my account?</strong></p>
        <p>
          You can request account deletion from <strong>Profile › Delete Account</strong> within the app, or
          by emailing {CONTACT}. Your account is deactivated immediately and you will no longer be able to sign
          in with your password, your PIN, or your QR code. For the next 30 days only an administrator of your
          company can reactivate it; after that period, deletion is permanent and irreversible.
        </p>

        <p><strong>Why is the app not detecting my location?</strong></p>
        <p>
          Make sure location permissions are enabled in your device settings. GPS detection works best
          outdoors. If the issue persists, restart the app and try again.
        </p>

        <p><strong>I can&apos;t clock in or out — what should I do?</strong></p>
        <p>
          Check your internet connection and make sure location permissions are enabled. If the problem
          continues, contact your supervisor or write to the support email.
        </p>

        <p><strong>How do I submit an expense report?</strong></p>
        <p>
          Navigate to the <strong>Expenses</strong> section from the main menu. Fill in the form, attach a
          receipt photo using the camera or gallery, and submit it for your supervisor&apos;s review.
        </p>

        <p><strong>Who do I contact about my work schedule?</strong></p>
        <p>
          Schedules are managed by your supervisor or administrator. Contact them directly for questions
          about project assignments and work hours.
        </p>
      </>
    ),
  },
  {
    num: 4,
    title: 'Related documents',
    body: (
      <ul>
        <li><Link className="ld-a" to="/privacy">Privacy Policy</Link></li>
        <li><Link className="ld-a" to="/terms">Terms of Service</Link></li>
      </ul>
    ),
  },
];

const es: LegalVersion = {
  lang: 'es',
  docTitle: 'Centro de Soporte',
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
  docTitle: 'Support Center',
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

export function Support() {
  return (
    <LegalDocument
      idPrefix="support"
      backHref="/"
      es={es}
      en={en}
      labels={{ spanish: 'Español', english: 'English', back: '← BuildTrack', kicker: 'Soporte · Support' }}
      footer={<>© 2026 Archlogic Systems · BuildTrack — 2a calle, zona 3, Huehuetenango, Guatemala</>}
    />
  );
}
