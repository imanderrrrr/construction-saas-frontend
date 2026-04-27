Eres un ingeniero backend senior (Spring Boot 3.x + Kotlin) y tienes acceso completo al repo. Tu tarea es EXPANDIR el sistema de auditoría para que cubra TODO el sistema (no solo /auth/login). Debes implementar auditoría consistente, consultable y segura, con pruebas automatizadas.

OBJETIVO GENERAL
1) Registrar en AuditLog TODA acción relevante de negocio y seguridad:
   - CREATE / UPDATE / DELETE de entidades principales.
   - Cambios de estado (aprobaciones, rechazos, correcciones).
   - Operaciones sensibles (exports, purges, cambios de permisos, subida/borrado de archivos, etc.).
2) Mantener el sistema robusto: no degradar performance, no exponer datos sensibles, y que falle de forma segura.
3) Mantener compatibilidad con lo ya existente (AuditLog actual y endpoint(s) existentes).

REGLAS / ALCANCE
A) Qué eventos auditar (mínimo obligatorio)
- Auth & Security:
  - login éxito / fallo (ya existe) + logout (si existe) + refresh token + cambio de password + reset password + bloqueo/desbloqueo (si existe).
  - cambios de roles / permisos / usuarios (create/update/disable/delete).
- Proyectos:
  - create/update/delete proyectos.
  - cambios a geofence y settings del proyecto.
- Horas (time entries):
  - clock-in/out, start/end lunch (creación de marca).
  - supervisor approve/reject/correct time entry.
  - cualquier corrección debe incluir “reason/comment”.
- Gastos:
  - create expense (incluyendo metadata del comprobante, no el binario).
  - approve/reject/observe/correct expense + motivo.
- Presupuestos:
  - create/update budget + cambios de líneas + thresholds/alert rules.
  - “impacto” por gastos aprobados (si se materializa) registrar evento de ajuste.
- Inventario:
  - tools: alta/baja/estado (disponible/asignada/reparación/perdida/baja), asignación/devolución, transferencias.
  - consumibles: entradas/salidas/ajustes, dispatch a proyecto, stock mínimo, cambios de catálogo.
- Finanzas:
  - AR/AP: create/update invoice/bill, registrar pagos parciales, marcar como paid/overdue, notas/ajustes.
- Reportes / Export:
  - cada export (PDF/Excel) debe auditar: quién, qué reporte, filtros principales (sin PII), formato, éxito/fallo.

B) Estructura del AuditLog (mínimo)
Si ya existe entidad AuditLog, extiéndela SIN romper compatibilidad:
- id, timestamp (server time), actorUserId, actorEmail/username (si aplica), actorRole (opcional si no es costoso), ipAddress, userAgent.
- action (enum o string normalizado): e.g. USER_CREATED, PROJECT_UPDATED, TIME_ENTRY_APPROVED, EXPENSE_REJECTED, REPORT_EXPORTED, etc.
- resourceType + resourceId (por ejemplo "Project", "123").
- outcome: SUCCESS | FAILURE
- message (humano corto)
- metadata JSON (map) con campos útiles (no secretos, no tokens, no passwords, no payload completo).
- correlationId / requestId para trazar una petición completa (si no existe, implementar).
- Para fallos, guardar errorCode (de tu ErrorResponse) y stacktrace NO (solo para logs internos).

C) Dónde instrumentar (no lo hagas “a mano” en cada controller si puedes evitarlo)
Implementa una estrategia consistente:
Opción preferida:
1) Auditoría central por “Domain Events”:
   - Define una interfaz AuditEventPublisher.
   - En servicios de negocio, al completar acción, publica evento (success/failure).
   - Listener persistente graba AuditLog.
2) Complementa con Interceptor/Filter para datos request-level:
   - Capturar requestId, ip, userAgent, path, method, actor (del SecurityContext).
   - Inyectar estos datos al contexto del auditor.

Alternativa aceptable:
- Spring AOP annotations (@Audited) en métodos de servicio con aspecto que persiste AuditLog.
Si eliges AOP, NO audites controllers, audita servicios.

D) Protección de datos
- NUNCA guardar contraseñas, tokens, secretos, llaves, headers de auth.
- No guardar imágenes/binarios.
- Limitar metadata: ids, montos, estados, nombres de proyecto (si aplica), pero evita PII excesivo.
- Si hay campos sensibles (ej. notas internas), no guardarlas completas; usar resumen.

E) Consistencia y normalización
- Define un catálogo de acciones (enum AuditAction) con nombres estables.
- Define resourceType normalizado.
- Outcome siempre presente.
- Timestamp siempre server-side.

F) API de consulta de auditoría (si ya existe, mejorarla)
- Endpoint para listar logs con filtros:
  - date range, actorUserId, action, resourceType, resourceId, outcome.
- Paginación obligatoria.
- Solo ADMIN (y si existe FINANCE o SUPERVISOR, solo si se define permiso explícito).
- Nunca permitir purge salvo que ya exista el mecanismo con doble protección (feature flag + header de confirmación). Respeta lo existente.

G) Pruebas automatizadas (obligatorio)
- Unit tests:
  - mapping de eventos a AuditLog.
  - sanitización de metadata (no tokens).
- Integration tests (MockMvc):
  - Ej: crear gasto -> se crea AuditLog action EXPENSE_CREATED.
  - aprobar gasto -> EXPENSE_APPROVED.
  - clock-in -> TIME_ENTRY_CREATED.
  - update project geofence -> PROJECT_GEOFENCE_UPDATED.
  - export report -> REPORT_EXPORTED.
- Tests de seguridad:
  - endpoints audit logs solo ADMIN.
- Si hay transacciones:
  - garantizar que si la acción de negocio falla y hace rollback, NO dejes audit log “SUCCESS”.
  - si quieres auditar fallos, deben registrarse como FAILURE con outcome correcto.

H) Migraciones
- Si agregas columnas a audit_log, crea migration (Flyway/Liquibase según repo).
- Backfill NO requerido, pero defaults seguros.

ENTREGABLES
1) Código implementado con auditoría transversal siguiendo lo anterior.
2) Nuevos tests verdes (./gradlew clean test).
3) Documentación breve en README o /docs: catálogo de acciones y ejemplos de metadata.

RESTRICCIONES
- No rompas endpoints existentes.
- No cambies contratos de auth.
- No duplicar logs: una acción debe generar 1 audit log principal (más sub-logs solo si hay eventos claramente distintos).
- No uses logs de consola como “auditoría”; debe persistirse en DB.

Antes de escribir código:
- Escanea el repo y enumera (en tu respuesta) las entidades/módulos existentes que vas a auditar y dónde las vas a instrumentar (services/clases).
- Luego implementa.