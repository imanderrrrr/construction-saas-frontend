# Movimientos con resultado incierto

Recepción y despacho guardan un diario en localStorage ANTES del POST: UUID,
payload exacto y estado pending/confirmed/refused. El ingreso se separa por id
de consumible; despacho mantiene una operación pendiente en su formulario e
incluye el artículo en el payload. El operador debe resolverla antes de iniciar
otra. Cambiar cantidad, cerrar, navegar o recargar no cancela un resultado incierto.

El botón «Consultar y confirmar movimiento» vuelve a enviar la misma intención.
Si el servidor ya la confirmó, reproduce el resultado sin otro asiento/cargo; si
no la recibió, la confirma con el payload guardado. Consultar stock por sí solo
no permite decidir si se confirmó una recepción entre movimientos concurrentes.
La recepción consulta existencias al abrir y al resolver; cerrar refresca la lista.
Despacho refresca catálogo, historial y totales también después de un error.

Una confirmación persiste hasta pulsar «Nueva recepción física» o «Nuevo despacho».
Esto evita que otra pestaña con el formulario anterior cree una segunda intención
sin advertirlo. Una recepción física posterior, incluso con igual cantidad, usa
una clave nueva. Web Locks serializa envío y apertura de una intención nueva
entre pestañas; antes del envío se comprueba que sigue siendo la misma sesión.
Sin Web Locks o sin poder persistir el diario no se envía el movimiento.

Un 4xx definitivo en el PRIMER intento permite corregir datos mediante una
nueva intención. Un 4xx posterior a un resultado desconocido conserva la operación:
no prueba que el primer POST fallara. No hay eliminación automática por tiempo.

El ámbito incluye empresa, cuenta, época de login, artículo/operación. La época
se comparte entre pestañas y sobrevive a recargas y renovación del token. Login
nuevo/logout retiran esa época; no borran diarios inciertos ni los muestran a
otra sesión. Una pestaña antigua oculta el payload si cambia la sesión y no puede
enviar con las credenciales nuevas. Los diarios retirados no se reejecutan al
volver a entrar. **Resolver antes de cerrar sesión**; conservar la referencia
para conciliación si se cerró o se perdió el navegador. No borrar almacenamiento
como solución a un resultado desconocido. La API y el inventario siguen siendo
la autoridad; el diario no sustituye permisos ni RLS.

El conteo físico no decide qué ocurrió con una intención. No se usa automáticamente
para compensar un ingreso o un despacho incierto. Las discrepancias físicas
independientes requieren el flujo de conteo con stockVersion de la API; esta
entrega no añade un panel de conteo ni altera saldos para forzar una conciliación.

Regresiones: warehouseIntent.test.ts (recarga, payload inmutable, concurrencia,
resets tardíos, almacenamiento, ámbitos); ConsumableWarehouseWindow.test.tsx y
ConsumableDispatch.form.test.tsx (desmontaje, reintento, sesión y nueva operación).
El navegador local se ensayó con la API real y pérdida de respuesta tras commit.
