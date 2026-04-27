Rol: Eres un Senior Frontend Engineer (React + TypeScript). Estás trabajando sobre el repo del frontend OFJR Construction (Vite + TS).
Objetivo: Implementar en el FRONTEND la regla funcional: “Un proyecto cerrado bloquea nuevos registros y modificaciones” con UX clara, consistente y sin romper flujos existentes.

Contexto obligatorio del negocio:
- El proyecto puede estar “cerrado” (CLOSED).
- Si un proyecto está cerrado, NO se permite:
  1) registrar nuevas horas (TimeClock)
  2) registrar gastos (Expense form / Expenses)
  3) asignar/entregar inventario al proyecto (si existe en UI)
  4) editar registros existentes asociados al proyecto (horas/gastos/inventario)
- El frontend NO debe “forzar” el backend; solo debe:
  - bloquear UI, 
  - ocultar/disabled acciones,
  - mostrar explicación,
  - y manejar errores del backend si llegan (por si backend ya aplica el bloqueo).

Restricciones (OBLIGATORIAS):
- NO cambies backend.
- NO inventes endpoints.
- NO cambies design system / estilos globales.
- Reutiliza componentes y patrones existentes (Alert/Banner, Badge, Tooltip, Disabled button, Empty state).
- Implementa el bloqueo en TODOS los lugares donde el usuario pueda iniciar acciones sobre un proyecto.

Tareas específicas a implementar:

A) Extender el modelo de Project en el frontend
1. Localiza el tipo/interface del proyecto (Project) y añade soporte para estado "CLOSED".
   - Si hoy solo existe ACTIVE/INACTIVE, añade CLOSED y asegúrate que no rompe compilación.
2. Donde se mapean o se muestran estados de proyecto, agrega el label “Closed / Cerrado” usando el mismo patrón de badges.

B) Detectar si un proyecto está cerrado (single source of truth frontend)
1. Crea un helper reutilizable:
   - function isProjectClosed(project: Project | null | undefined): boolean
   - o un selector/hook useProjectStatus(projectId) si ya existe un patrón.
2. Evita duplicar lógica en 10 archivos: usa el helper.

C) Bloqueo de UI en puntos críticos (obligatorio)
Implementa la regla en las pantallas:
1) TimeClock (registro de horas):
   - Si el usuario está intentando marcar en un proyecto CLOSED:
     - deshabilita los botones de marcar (Check-in / Lunch / Check-out)
     - muestra un Banner/Alert arriba: “Este proyecto está cerrado. No se permiten nuevas marcaciones.”
     - si hay selector de proyecto, al seleccionar un proyecto CLOSED:
       - mostrar estado “Cerrado” y el banner aparece inmediatamente.
2) Formulario de Gastos (Expense create / Expenses):
   - Si el gasto se intenta asociar a proyecto CLOSED:
     - deshabilitar botón “Guardar/Enviar”
     - mostrar mensaje junto al selector: “No puedes registrar gastos en un proyecto cerrado.”
3) Edición:
   - Si existen pantallas de Edit Time Entry / Edit Expense:
     - deshabilitar campos editables y botón guardar,
     - mostrar banner: “Registro bloqueado porque el proyecto está cerrado.”
4) Inventario:
   - Si existe UI para asignar/entregar inventario a un proyecto:
     - bloquear asignación cuando proyecto CLOSED.
NOTA: Si alguna pantalla no existe, deja un comentario TODO con referencia al nombre de ruta o componente previsto; pero NO inventes pantallas nuevas.

D) Navegación y feedback (UX coherente)
1. Los botones bloqueados deben tener:
   - Disabled state + tooltip (si el proyecto está cerrado) con el texto “Proyecto cerrado”.
2. Si el usuario llega a un flujo bloqueado desde un link directo:
   - la pantalla debe renderizarse sin crash y mostrar el banner.
3. No uses alert() del navegador.

E) Manejo de errores del backend (por compatibilidad)
1. Donde se ejecutan acciones (submit, mark time, etc.), si el backend responde con 403/409 por “project closed”:
   - captura y muestra un toast/alert “No se pudo completar: el proyecto está cerrado.”
2. No asumas el shape exacto del error si no está estandarizado; usa el manejo de errores existente.

F) QA mínimo (obligatorio)
1. Agrega o actualiza tests si el repo ya usa testing (React Testing Library / Vitest):
   - Caso: al seleccionar proyecto CLOSED, botones de marcar están disabled.
   - Caso: banner visible.
Si no hay testing infra, al menos agrega una sección en README o comentario “Manual QA checklist”.

Checklist de aceptación (debe cumplirse todo):
- No se puede iniciar ninguna acción de creación/edición sobre un proyecto CLOSED desde la UI.
- El usuario entiende por qué (banner/tooltip).
- No se rompe el build.
- No se cambian estilos globales.
- No se agregan endpoints.

Entrega:
- Lista de archivos modificados.
- Breve resumen de comportamiento por pantalla afectada.