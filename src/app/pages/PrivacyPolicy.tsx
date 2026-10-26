import { LegalDocument, type LegalVersion } from './legal/LegalDocument';
import { SUPPORT_EMAIL, supportMailto } from '../lib/contact';

const es: LegalVersion = {
  lang: 'es',
  docTitle: 'Política de Privacidad',
  updatedLabel: 'Última actualización: 26 de octubre de 2026 — v2.3',
  tocLabel: 'Contenido',
  meta: [
    { label: 'Proveedor', value: 'Archlogic Systems' },
    { label: 'Producto', value: 'BuildTrack · app «BuildTrack Field»' },
    { label: 'Domicilio', value: '2a calle, zona 3, Huehuetenango, Guatemala' },
    { label: 'Ley aplicable', value: 'República de Guatemala' },
    {
      label: 'Contacto',
      value: (
        <a className="ld-a" href={supportMailto()}>
          {SUPPORT_EMAIL}
        </a>
      ),
    },
    { label: 'Versión', value: '2.3' },
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
            BuildTrack Field y un panel web de administración. Esta política explica cómo se tratan los datos
            personales dentro de BuildTrack.
          </p>
          <p>
            Como es una plataforma que usan varias empresas a la vez, distingue dos situaciones según quién
            decide sobre los datos, que se detallan en la sección 2.
          </p>
          <p>
            Esta política también cubre el sitio web público de BuildTrack (buildtrackfield.com), incluidos su
            asistente de inteligencia artificial (IA) y su formulario de contacto.
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
            <li>
              <strong>Datos del sitio web público</strong> (mensajes al asistente de IA y datos que se dejan en el
              formulario de contacto): Archlogic es el responsable del tratamiento.
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
            <strong>Datos de cuenta:</strong> nombre de usuario, nombre completo y rol asignado (trabajador,
            subcontratista, supervisor, administrador, etc.). La aplicación móvil no solicita ni transmite
            correo electrónico ni número de teléfono. En el panel web, el correo electrónico se usa en el alta de la empresa, donde lo escribe la persona administradora que la registra para poder restablecer su propia contraseña, y cuando la empresa decide enviar por correo una invitación o un enlace de firma.
          </li>
          <li>
            <strong>Ubicación (GPS):</strong> se usa para verificar la presencia en las obras asignadas (geocerca), registrar la ubicación de las marcas y mostrar mapas y rutas de trabajo. Mientras la pantalla de fichaje está abierta, la app recibe actualizaciones de ubicación para mostrar la posición, la distancia al sitio o al destino de un viaje y avisos de llegada. Las coordenadas se envían al servidor al registrar una marca (entrada, almuerzo, viaje, llegada o salida) o al pedir el camino a un destino, que el servidor calcula con Google sin guardarlo. Al buscar un lugar de destino se envía además una ubicación aproximada (de alrededor de 1 km) para mostrar lugares cercanos. No se rastrea en segundo plano. Los destinos que son lugares no se verifican mediante una geocerca de Google. Las funciones disponibles dependen de la empresa y del servicio conectado. Si la persona elige abrir el camino en Google Maps o Waze, esa app recibe las coordenadas del destino y las trata según su propia política.
          </li>
          <li>
            <strong>Cámara, micrófono y galería:</strong> para escanear el QR de acceso, capturar recibos, evidencia de avance de obra y documentos de facturación. Los videos de avance incluyen el sonido captado durante la grabación. El micrófono también permite dictar notas de bitácora cuando la persona activa esa función; el reconocimiento de voz del sistema convierte el audio en texto y puede procesarlo en sus servidores (Apple en iOS, según el idioma y el dispositivo). El texto resultante se incorpora a la nota que la persona edita y guarda. La app no graba audio en segundo plano. Las imágenes, los videos y las notas enviados se almacenan para prestar el servicio a la empresa.
          </li>
          <li>
            <strong>Registro de jornada:</strong> marcas de entrada, almuerzo, viaje, llegada y salida; proyecto asignado, identificador del destino, ubicación registrada y estado de revisión. También se guardan las notas y evidencias de bitácora enviadas por la persona.
          </li>
          <li>
            <strong>Datos financieros del trabajo:</strong> facturas, montos, conceptos y estados de pago
            relacionados con la actividad del usuario en la plataforma.
          </li>
          <li>
            <strong>Clima de la bitácora:</strong> cuando la persona pide en la bitácora detectar el clima automáticamente, nuestro servidor consulta el clima actual al Instituto Meteorológico de Noruega (MET Norway) enviando las coordenadas registradas de la obra, redondeadas a unos 11 metros, no la ubicación del dispositivo. La consulta sale de nuestro servidor, por lo que MET Norway no recibe la dirección IP del dispositivo, el nombre ni otros datos de la cuenta.
          </li>
          <li>
            <strong>Firmas de documentos:</strong> cuando un representante del cliente firma un documento que la empresa le presenta (un ticket de trabajo por administración T&amp;M o una factura de cobro), en el dispositivo del supervisor o mediante un enlace, se registran su nombre, su cargo, la imagen de su firma manuscrita, la fecha y hora, la dirección IP y el navegador o dispositivo usado, junto con una copia del documento firmado. Si lo rechaza desde el enlace, se registran el motivo, la fecha y hora, la dirección IP y el navegador. Si el enlace se envía por correo, se guardan además el nombre y el correo del destinatario. Si firma en el dispositivo del supervisor, la IP y el dispositivo registrados son los de ese teléfono. Estos datos se conservan como evidencia del documento por cuenta de la empresa Cliente.
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
          <li>
            <strong>Asistente de IA y formulario de contacto del sitio web:</strong> los mensajes que usted escribe
            al asistente se envían a nuestro servidor y a Anthropic, el proveedor del modelo de IA, para generar la
            respuesta. No guardamos el contenido de las conversaciones: la conversación existe solo en su navegador
            mientras la ventana está abierta. No escriba datos personales en el chat. Si deja sus datos en el
            formulario de contacto, guardamos su nombre, su empresa, su correo o teléfono, su interés (una
            demostración o la beta), el idioma, si llegó por el asistente o por el formulario, la fecha y la
            versión del texto de consentimiento que aceptó, y enviamos esos datos por correo a nuestro equipo.
            Para comprobar que quien escribe es una persona usamos Cloudflare Turnstile. Su dirección IP se usa
            de forma temporal para limitar la cantidad de mensajes y envíos, y no se guarda con el contacto.
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
          <li>
            Responder preguntas sobre BuildTrack en el sitio web y contactar a quien pide una demostración o
            unirse a la beta.
          </li>
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
            servicio; responder las preguntas de los visitantes del sitio web y proteger el sitio contra el abuso.
          </li>
          <li>
            <strong>Consentimiento:</strong> para el acceso a permisos del dispositivo (ubicación, cámara,
            micrófono, reconocimiento de voz, galería), revocables en cualquier momento desde la configuración del sistema,
            y para contactarlo cuando deja sus datos en el formulario del sitio web, mediante su casilla de
            consentimiento.
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
            Para prestar el servicio utilizamos estos proveedores. El alojamiento y el envío de correo procesan datos por cuenta de Archlogic; los mapas, el reconocimiento de voz, el servicio de clima, el modelo de IA y la verificación anti-bot también pueden procesar datos conforme a las políticas de sus proveedores:
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
            <li><strong>Brevo:</strong> envío de correos transaccionales (invitaciones, restablecimiento de contraseña, enlaces de firma y el aviso a nuestro equipo de cada contacto del sitio web); recibe la dirección de correo del destinatario y el contenido del mensaje.</li>
            <li><strong>Anthropic:</strong> modelo de IA del asistente del sitio web. Recibe de nuestro servidor los mensajes de la conversación, sin su dirección IP ni los datos del formulario de contacto, y los trata para generar la respuesta conforme a sus condiciones comerciales. Se aplica la <a className="ld-a" href="https://www.anthropic.com/legal/privacy" target="_blank" rel="noopener noreferrer">Política de privacidad de Anthropic</a>.</li>
            <li><strong>Cloudflare Turnstile:</strong> verificación anti-bot del asistente y del formulario de contacto del sitio web. Al iniciar una conversación o enviar el formulario, Cloudflare recibe datos técnicos del navegador y de la conexión, incluida la dirección IP, para comprobar que se trata de una persona. Se aplica la <a className="ld-a" href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener noreferrer">Política de privacidad de Cloudflare</a>.</li>
            <li><strong>Google Maps:</strong> mapas dentro de la app, búsqueda de lugares y cálculo de rutas. Sus SDK pueden tratar identificadores del dispositivo, interacciones con el mapa y datos de fallos y rendimiento para funcionalidad y análisis del servicio. La búsqueda y las rutas reciben los datos necesarios de origen y destino. El servidor conserva el identificador del lugar, sin almacenar su nombre, dirección, coordenadas de Google ni el contenido de la ruta. Se aplican los <a className="ld-a" href="https://maps.google.com/help/terms_maps.html" target="_blank" rel="noopener noreferrer">Términos de Google Maps</a> y la <a className="ld-a" href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Política de privacidad de Google</a>.</li>
            <li><strong>Reconocimiento de voz del sistema:</strong> convertir la voz en texto mediante el servicio del sistema, con autorización del dispositivo. Según el idioma y el dispositivo, el audio puede enviarse al proveedor del reconocimiento; en iOS se usa el servicio de Apple.</li>
            <li><strong>MET Norway (Instituto Meteorológico de Noruega):</strong> datos meteorológicos para la bitácora. Recibe de nuestro servidor las coordenadas de la obra, sin la dirección IP del dispositivo ni datos de la cuenta. Se aplican sus <a className="ld-a" href="https://api.met.no/doc/TermsOfService" target="_blank" rel="noopener noreferrer">condiciones</a>.</li>
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
            <li>Los proveedores de la sección 6: los de alojamiento y correo, bajo acuerdos de confidencialidad y tratamiento de datos; los demás, conforme a sus propias políticas.</li>
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
          residencia, incluyendo Estados Unidos (Render, AWS/Supabase, Vercel, Anthropic, Cloudflare) y las jurisdicciones de
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
            <strong>Ubicación precisa (GPS):</strong> verificar la presencia en las obras, registrar la ubicación de las marcas y mostrar mapas y rutas mientras se usa la app.
          </li>
          <li>
            <strong>Cámara:</strong> escanear el código QR de inicio de sesión y capturar recibos y evidencia
            del avance de obra, en foto o en video.
          </li>
          <li>
            <strong>Micrófono:</strong> grabar sonido durante videos de evidencia y dictar notas de bitácora cuando la persona inicia esas funciones. No se graba audio en segundo plano.
          </li>
          <li><strong>Reconocimiento de voz:</strong> convertir la voz en texto mediante el servicio del sistema, con autorización del dispositivo. Según el idioma y el dispositivo, el audio puede enviarse al proveedor del reconocimiento; en iOS se usa el servicio de Apple.</li>
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
        <>
          <p>
            Los datos personales se conservan mientras la cuenta esté activa.
          </p>
          <p>
            Al solicitar la eliminación de su cuenta, esta se desactiva de inmediato: se cierran todas sus
            sesiones y ya no es posible iniciar sesión con su contraseña, su PIN ni su código QR. Durante los 30
            días siguientes la cuenta permanece «pendiente de eliminación» y solo un administrador de su empresa
            puede reactivarla; pasado ese plazo, la eliminación se vuelve permanente e irreversible: su nombre
            de usuario, su nombre completo, su correo electrónico, su contraseña y su PIN se eliminan de forma
            definitiva y sus códigos QR quedan invalidados. Los registros operativos generados durante su
            trabajo (jornadas, gastos, asignaciones de herramientas y la bitácora de auditoría) se conservan
            porque la empresa los necesita para su nómina, su contabilidad y la seguridad del sistema, pero
            quedan desvinculados de su perfil, que deja de contener datos personales.
          </p>
          <p>
            Los plazos de conservación de esos registros operativos los define la empresa Cliente, como
            responsable, según las obligaciones legales, laborales y fiscales que le apliquen; transcurridos, se
            eliminan de forma segura.
          </p>
          <p>
            Los contactos dejados en el formulario del sitio web se eliminan automáticamente a los 12 meses; puede
            pedir que se borren antes escribiendo a{' '}
            <a className="ld-a" href={supportMailto()}>
              {SUPPORT_EMAIL}
            </a>
            . El contenido de las conversaciones con el asistente no se guarda en nuestros servidores.
          </p>
        </>
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
              suscripción, contactos y mensajes del sitio web), escriba a{' '}
              <a className="ld-a" href={supportMailto()}>
                {SUPPORT_EMAIL}
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
          La aplicación móvil no utiliza cookies ni incluye herramientas propias de publicidad o analítica. El
          SDK de Google Maps integrado en la app puede recopilar identificadores del dispositivo y datos de uso,
          fallos y rendimiento con fines de análisis del servicio de mapas (ver sección 6). El panel web usa
          cookies técnicas para la sesión, la protección contra falsificación de solicitudes y recordar la
          empresa con la que se inició sesión, y el almacenamiento del navegador para preferencias de la
          interfaz y pasos en curso, como las guías ya vistas o el alta de la empresa; no emplea cookies de
          seguimiento, publicidad ni analítica de terceros. En el sitio web público, el asistente guarda la
          conversación solo en la memoria de la ventana, y la verificación de Cloudflare Turnstile se carga
          únicamente al iniciar una conversación o enviar el formulario.
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
          <a className="ld-a" href={supportMailto()}>
            {SUPPORT_EMAIL}
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
  updatedLabel: 'Last updated: October 26, 2026 — v2.3',
  tocLabel: 'Contents',
  meta: [
    { label: 'Provider', value: 'Archlogic Systems' },
    { label: 'Product', value: 'BuildTrack · "BuildTrack Field" app' },
    { label: 'Address', value: '2a calle, zona 3, Huehuetenango, Guatemala' },
    { label: 'Governing law', value: 'Republic of Guatemala' },
    {
      label: 'Contact',
      value: (
        <a className="ld-a" href={supportMailto()}>
          {SUPPORT_EMAIL}
        </a>
      ),
    },
    { label: 'Version', value: '2.3' },
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
            ("Customers"). BuildTrack consists of the BuildTrack Field application and a web
            administration panel. This policy explains how personal data is handled within BuildTrack.
          </p>
          <p>
            Because it is a platform used by multiple companies at once, it distinguishes two situations
            depending
            on who decides about the data, detailed in section 2.
          </p>
          <p>
            This policy also covers the public BuildTrack website (buildtrackfield.com), including its artificial
            intelligence (AI) assistant and its contact form.
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
              photographic evidence, and invoices): the Customer company that employs or contracts you is the
              data
              controller; it decides what is recorded and for what purpose, within its employment or commercial
              relationship with you. Archlogic acts as the data processor, meaning it processes that data on
              behalf
              of and following the instructions of that company. If you are a worker, subcontractor, or
              supervisor,
              your employer or contractor is the one who controls this data.
            </li>
            <li>
              <strong>Administration account, subscription, and platform data</strong> (data of the administrator
              who subscribes to BuildTrack, subscription billing, and technical and security data of the
              service):
              with respect to these, Archlogic is the data controller.
            </li>
            <li>
              <strong>Public website data</strong> (messages to the AI assistant and details left in the contact
              form): Archlogic is the data controller.
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
            <strong>Account data:</strong> username, full name, and assigned role (worker, subcontractor,
            supervisor, administrator, etc.). The mobile app neither asks for nor transmits an email address or
            a phone number. In the web panel, an email address is used during the company&rsquo;s sign-up, where it is typed by the administrator registering the company so that they can reset their own password, and when the company chooses to send an invitation or a signature link by email.
          </li>
          <li>
            <strong>Location (GPS):</strong> used to verify presence at assigned construction sites (geofence), record the location of time events and display work maps and routes. While the time-tracking screen is open, the app receives location updates to show position, distance to the site or trip destination and arrival prompts. Coordinates are sent to the server when recording a time event (check-in, lunch, trip, arrival or check-out) or requesting the way to a destination, which the server works out with Google without storing it. Place search also sends an approximate location (around 1 km) to show nearby destinations. The app does not track location in the background. Place destinations are not verified against a Google geofence. Available features depend on the company and connected service. If the user chooses to open the route in Google Maps or Waze, that app receives the destination coordinates and handles them under its own policy.
          </li>
          <li>
            <strong>Camera, microphone and gallery:</strong> used to scan the sign-in QR, capture receipts, construction-progress evidence and invoicing documents. Progress videos include sound captured during recording. The microphone also supports dictated site-log notes when the user starts that feature; system speech recognition converts audio to text and may process it on its servers (Apple on iOS, depending on language and device). The resulting text is added to the note the user edits and saves. The app does not record audio in the background. Submitted images, videos and notes are stored to provide the service to the company.
          </li>
          <li>
            <strong>Work records:</strong> check-in, lunch, trip, arrival and check-out events; assigned project, destination identifier, recorded location and review status. Submitted site-log notes and evidence are also stored.
          </li>
          <li>
            <strong>Work-related financial data:</strong> invoices, amounts, descriptions, and payment statuses
            related to the user's activity on the platform.
          </li>
          <li>
            <strong>Site-log weather:</strong> when the user asks the site log to detect the weather automatically, our server requests the current weather from the Norwegian Meteorological Institute (MET Norway), sending the recorded coordinates of the site, rounded to about 11 meters, not the device's location. The request comes from our server, so MET Norway does not receive the device's IP address, name or other account data.
          </li>
          <li>
            <strong>Document signatures:</strong> when a client representative signs a document the company presents to them (a time-and-materials (T&amp;M) ticket or a receivable invoice), on the supervisor's device or through a link, the platform records their name, title, an image of their handwritten signature, the date and time, the IP address and the browser or device used, together with a copy of the signed document. If they decline it from the link, the reason, date and time, IP address and browser are recorded. If the link is sent by email, the recipient's name and email address are also kept. When signing on the supervisor's device, the recorded IP address and device are those of that phone. This data is kept as evidence of the document on behalf of the Customer company.
          </li>
          <li>
            <strong>Subscription billing data</strong> (only for the subscribing Customer): payments are
            processed through Paddle; Archlogic does not store full card numbers.
          </li>
          <li>
            <strong>Technical data:</strong> IP address, device type, operating system, app version, and
            diagnostic identifiers, collected automatically for security and diagnostics.
          </li>
          <li>
            <strong>Website AI assistant and contact form:</strong> the messages you type to the assistant
            are sent to our server and to Anthropic, the AI model provider, to generate the answer. We do not keep
            the content of conversations: the conversation exists only in your browser while the window is open.
            Don't type personal details in the chat. If you leave your details in the contact form, we keep
            your name, company, email or phone, your interest (a demo or the beta), the language, whether you came
            through the assistant or the form, the date and the version of the consent text you accepted, and we
            send those details by email to our team. We use Cloudflare Turnstile to check that the person writing
            is human. Your IP address is used temporarily to limit the number of messages and submissions, and it
            is not stored with the contact.
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
          <li>
            Answer questions about BuildTrack on the website and contact those who ask for a demo or to join the
            beta.
          </li>
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
            <strong>Legitimate interest:</strong> platform security, fraud prevention, and service improvement;
            answering website visitors' questions and protecting the site against abuse.
          </li>
          <li>
            <strong>Consent:</strong> for access to device permissions (location, camera, microphone, speech recognition, gallery),
            revocable at any time from system settings, and for contacting you when you leave your details in the
            website form, through its consent box.
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
            To provide the service we use these providers. Hosting and email delivery process data on behalf of Archlogic; maps, speech recognition, the weather service, the AI model and the anti-bot check may also process data under their providers’ policies:
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
            <li><strong>Brevo:</strong> transactional email delivery (invitations, password resets, signature links and the notice to our team of each contact from the website); it receives the recipient's email address and the message content.</li>
            <li><strong>Anthropic:</strong> AI model of the website assistant. It receives the conversation's messages from our server, without your IP address or the contact form details, and processes them to generate the answer under its commercial terms. The <a className="ld-a" href="https://www.anthropic.com/legal/privacy" target="_blank" rel="noopener noreferrer">Anthropic Privacy Policy</a> applies.</li>
            <li><strong>Cloudflare Turnstile:</strong> anti-bot check for the website assistant and contact form. When a conversation starts or the form is sent, Cloudflare receives technical data about the browser and the connection, including the IP address, to check that a person is there. The <a className="ld-a" href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener noreferrer">Cloudflare Privacy Policy</a> applies.</li>
            <li><strong>Google Maps:</strong> in-app maps, place search and route calculation. Its SDKs may process device identifiers, map interactions and crash and performance data for service functionality and analytics. Search and routing receive the origin and destination data needed for the request. The server retains the place identifier without storing its Google name, address, coordinates or route content. <a className="ld-a" href="https://maps.google.com/help/terms_maps.html" target="_blank" rel="noopener noreferrer">Google Maps Terms</a> and <a className="ld-a" href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google Privacy Policy</a> apply.</li>
            <li><strong>System speech recognition:</strong> convert voice to text using the system service, with device authorization. Depending on language and device, audio may be sent to the recognition provider; iOS uses Apple’s service.</li>
            <li><strong>MET Norway (Norwegian Meteorological Institute):</strong> weather data for the site log. It receives the site's coordinates from our server, without the device's IP address or any account data. Its <a className="ld-a" href="https://api.met.no/doc/TermsOfService" target="_blank" rel="noopener noreferrer">terms</a> apply.</li>
            <li>
              <strong>Google Play Services:</strong> required for the app to operate on Android devices; may
              collect device information and identifiers.
            </li>
          </ul>
          <p>
            If error diagnostics (Sentry) are enabled, minimal technical data is processed for stability
            purposes;
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
            <li>The providers listed in section 6: hosting and email providers under confidentiality and data processing agreements; the others under their own policies.</li>
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
          including the United States (Render, AWS/Supabase, Vercel, Anthropic, Cloudflare) and Paddle's payment processing
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
            <strong>Precise location (GPS):</strong> verify presence at job sites, record time-event locations and show maps and routes while the app is in use.
          </li>
          <li>
            <strong>Camera:</strong> scan the sign-in QR code and capture receipts and evidence of construction
            progress, as photos or video.
          </li>
          <li>
            <strong>Microphone:</strong> record sound during progress videos and dictate site-log notes when the user starts those functions. Audio is not recorded in the background.
          </li>
          <li><strong>Speech recognition:</strong> convert voice to text using the system service, with device authorization. Depending on language and device, audio may be sent to the recognition provider; iOS uses Apple’s service.</li>
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
        <>
          <p>
            Personal data is retained while the account is active.
          </p>
          <p>
            When you request deletion of your account, it is deactivated immediately: all your sessions are
            closed and it is no longer possible to sign in with your password, your PIN, or your QR code. For
            the next 30 days the account remains "pending deletion" and only an administrator of your company
            can reactivate it; after that period, deletion becomes permanent and irreversible: your username,
            full name, email address, password, and PIN are permanently erased and your QR codes are
            invalidated. Operational records generated during your work (time records, expenses, tool
            assignments, and the audit log) are retained because your company needs them for payroll,
            accounting, and system security, but they are unlinked from your profile, which no longer contains
            any personal data.
          </p>
          <p>
            The retention periods for those operational records are defined by the Customer company, as
            controller, according to the legal, labor, and tax obligations applicable to it; once elapsed, the
            records are securely deleted.
          </p>
          <p>
            Contacts left in the website form are deleted automatically after 12 months; you can ask for earlier
            deletion by writing to{' '}
            <a className="ld-a" href={supportMailto()}>
              {SUPPORT_EMAIL}
            </a>
            . The content of conversations with the assistant is not stored on our servers.
          </p>
        </>
      ),
    },
    {
      num: 12,
      title: 'Your rights',
      body: (
        <>
          <p>
            You have the right to access your data, request its correction or deletion, request its
            portability in
            a machine-readable format, and revoke device permissions at any time.
          </p>
          <ul>
            <li>
              If your data is controlled by your company (attendance, hours, expenses, evidence), contact it
              first
              as the controller. Archlogic will assist it in its capacity as processor.
            </li>
            <li>
              For data of which Archlogic is the controller (administration account, subscription billing,
              website contacts and messages), email{' '}
              <a className="ld-a" href={supportMailto()}>
                {SUPPORT_EMAIL}
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
          The mobile application does not use cookies and includes no advertising or analytics tools of its
          own. The Google Maps SDK built into the app may collect device identifiers and usage, crash and
          performance data to analyze the maps service (see section 6). The web panel uses technical
          cookies for the session, for protection against request forgery and to remember the company last
          signed in to, and browser storage for interface preferences and steps in progress, such as guides
          already seen or company sign-up; it does not use tracking, advertising or third-party analytics
          cookies. On the public website, the assistant keeps the conversation only in the window's memory, and
          the Cloudflare Turnstile check loads only when a conversation starts or the form is sent.
        </p>
      ),
    },
    {
      num: 15,
      title: 'Changes to this policy and contact',
      body: (
        <p>
          We may update this policy; changes will be posted on this page with their date and version, and
          material changes will be announced through the application. For any privacy inquiries, contact us
          at{' '}
          <a className="ld-a" href={supportMailto()}>
            {SUPPORT_EMAIL}
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
