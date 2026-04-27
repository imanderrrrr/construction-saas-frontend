Rol: Eres un Product Designer + UX Designer senior trabajando dentro de Figma.
Objetivo: Integrar en el diseño existente del sistema OFJR Construction los elementos necesarios para calcular costos de mano de obra (horas aprobadas × tarifa por hora) y exponerlos en pantallas coherentes con la UI actual.
Regla de oro: NO cambies el look & feel del sistema, reutiliza componentes existentes (tables, cards, filters, modals, badges, tabs). NO inventes módulos contables fiscales. Mantén arquitectura centralizada + control por roles.

Contexto funcional obligatorio:
- La tarifa por hora se asigna a cada usuario.
- El costo de mano de obra por proyecto se calcula SOLO con horas APROBADAS.
- El costo de mano de obra se muestra por proyecto (total) y por trabajador (detalle).
- Debe haber trazabilidad visual: lo pendiente/no aprobado NO impacta costos.

Entregables (OBLIGATORIOS) en Figma:
1) Pantalla / Sección nueva: “Usuarios → Editar usuario (Admin)”
   - Agregar campo “Tarifa por hora” (numérico, moneda configurable si ya existe; si no existe, solo mostrar ‘Q’ o ‘USD’ como prefijo visual y dejar moneda como texto estático).
   - Validaciones UI:
     - No permitir valores negativos.
     - Máximo 2 decimales.
     - Mostrar helper text: “Se usa para calcular costo de mano de obra (horas aprobadas × tarifa)”.
   - Estados:
     - Empty / Filled / Error (formato inválido) / Disabled (sin permisos).
   - Permisos:
     - Solo visible y editable para rol ADMIN.
     - Para roles no admin: el campo NO aparece (no solo deshabilitado).
   - Colocar el campo en una posición lógica junto a datos del usuario (ej. info laboral).

2) Pantalla nueva (o tab dentro de Proyecto): “Proyecto → Finanzas → Mano de obra”
   - Debe existir dentro del detalle del proyecto, en el área financiera ya existente (si hay tab “Financials”, agregar sub-tab “Mano de obra”).
   - Componentes:
     A) KPI cards arriba (3):
        - “Horas aprobadas (rango seleccionado)”
        - “Costo mano de obra (rango seleccionado)”
        - “Horas pendientes (no impactan costos)”
     B) Filtros (reusar patrón actual):
        - Date range (obligatorio)
        - Supervisor (opcional)
        - Trabajador (opcional)
        - Estado (por defecto: Approved; permitir ver Pending/Rejected pero con aviso)
     C) Tabla detalle por trabajador:
        Columnas:
        - Trabajador (nombre)
        - Rol/puesto (si existe en el sistema; si no existe, omitir)
        - Tarifa por hora
        - Horas aprobadas
        - Costo (horas × tarifa)
        - Acción “Ver detalle”
     D) Drawer/Modal “Detalle de horas” al presionar “Ver detalle”:
        - Lista de registros de tiempo aprobados con:
          Fecha, Entrada, Salida, Break/Lunch, Total horas, Aprobado por, Comentario (si existe)
        - Mostrar badge verde “Approved”.
   - Mensajes de estado:
     - Si no hay tarifa configurada para un trabajador: mostrar warning “Tarifa no definida” y el costo como “—” y un CTA pequeño “Editar usuario” (solo visible para ADMIN).
   - Nota visible (importante):
     - Texto: “Solo horas aprobadas impactan el costo de mano de obra.”
     - “Pendiente / Rechazado” no impactan costo.

3) Reporte nuevo: “Reportes → Mano de obra / Planilla (por período)”
   - Objetivo: generar un resumen por período de pago (semana/quincena/mes) para ver totales por trabajador.
   - UI:
     - Selector de período:
       - Date range + presets (Semanal / Quincenal / Mensual) si ya existen presets en filtros; si no, solo date range.
     - Filtros:
       - Proyecto (opcional; por defecto All Projects)
       - Trabajador (opcional)
       - Supervisor (opcional)
     - Tabla:
       - Trabajador | Tarifa | Horas aprobadas | Total a pagar (horas×tarifa) | Observaciones
     - Botones de exportación:
       - “Exportar Excel”
       - “Exportar PDF”
     - Banner informativo:
       - “Este reporte usa solo horas aprobadas.”
   - Permisos:
     - Visible para ADMIN y FINANCE/CONTADOR (si ese rol existe en UI).
     - Oculto para TRABAJADOR.

4) Microcopy y UI states (OBLIGATORIO):
   - Definir textos para empty state:
     - “No hay horas aprobadas en el rango seleccionado.”
   - Definir loading state (skeletons) usando el mismo patrón visual del sistema.
   - Definir error state:
     - “No se pudieron cargar los datos. Reintentar.”

5) Componentes reutilizables (OBLIGATORIO):
   - Si el sistema ya tiene componentes de:
     - filtros por fecha
     - tablas con acciones
     - badges por estado
     - modals/drawers
     Reutilízalos y mantén spacing y tipografía.
   - NO crees un nuevo design system.

6) Navegación (OBLIGATORIO):
   - Agregar entradas de menú solo si el sistema ya maneja menú de Reportes/Usuarios/Proyectos:
     - “Reportes → Mano de obra”
   - Para “Proyecto → Finanzas → Mano de obra”, que sea accesible desde la página de detalle del proyecto.

7) Output final que debes entregar:
   - Frames listos y ordenados:
     - Users_EditUser_WithHourlyRate
     - Project_Financials_LaborCost
     - Project_Financials_LaborCost_DetailModal
     - Reports_LaborPayroll
   - Prototipo navegable:
     - Desde Proyecto → Finanzas → Mano de obra → Ver detalle
     - Desde Reportes → Mano de obra → Export actions (solo UI)
   - Nota en cada frame: permisos y lógica en una pequeña sección “Specs”.

Restricciones:
- NO modifiques backend ni inventes endpoints; solo diseña UI/UX.
- NO agregues contabilidad fiscal, impuestos, nómina legal completa.
- NO cambies colores/estilos globales.
- NO uses suposiciones raras: si falta algún campo en usuario (puesto, moneda, etc.), no lo inventes; solo diseña para lo que sí es imprescindible (tarifa/hora).

Comienza analizando los frames existentes del sistema en Figma para mantener consistencia.
Luego implementa estos cambios exactamente.