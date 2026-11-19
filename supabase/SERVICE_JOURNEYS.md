# Seguimiento de contrataciones

## Activación

1. Aplica la migración 0010 de solicitudes y luego la 0011 de recorridos. La 0011 añade `service_journeys` a la publicación `supabase_realtime`. Solo se publican cambios de estado y tiempos de actualización. Las coordenadas y el identificador de la sesión de escritura permanecen en una tabla separada, accesible únicamente por RPC.
2. En Supabase, comprueba que Realtime tenga habilitado Postgres Changes para `service_journeys`. El canal privado `service-journey:<UUID>` verifica la membresía de la solicitud. Si el canal se interrumpe, la pantalla visible consulta un respaldo HTTP de manera periódica.
3. Habilita Supabase Cron y programa la limpieza con el propietario de la base, una vez por minuto. La aplicación deja de entregar posiciones de más de 45 segundos y la sesión vence después de 65 segundos sin publicación válida, incluso si Cron todavía no está configurado. Cron elimina del almacenamiento activo la última posición de las sesiones vencidas.

   ```sql
   select cron.schedule(
     'chambeaya-expired-service-journeys',
     '* * * * *',
     'select public.purge_inactive_service_journeys()'
   );
   ```

4. Con dos cuentas, confirma una contratación. Desde su detalle, el cliente confirma el destino y el trabajador pulsa **Estoy en camino**. Comprueba que el cliente vea posiciones nuevas sin recargar, que una sesión duplicada se rechace y que una cuenta ajena no pueda acceder. Detén las actualizaciones y verifica el mensaje de ubicación sin actualizar. Prueba **Detener seguimiento**, **He llegado** y la cancelación en una contratación separada. La cancelación conserva el acuerdo original como historial, marca cancelada la ejecución e impide al trabajador seguir consultando la dirección.

La geolocalización web requiere HTTPS o localhost y permiso del navegador. Bloquear la pantalla o cambiar de aplicación puede suspender el GPS. Reabrir o recargar la pantalla no reinicia el seguimiento. Terminarlo elimina la última posición y conserva los tiempos y el estado del recorrido.

## Mapas y proveedores

Buscar, seleccionar destino y seguir una contratación usan MapLibre con OpenFreeMap. Los estilos Liberty, Positron y Dark conservan la atribución cartográfica. El mapa de disponibilidad del perfil profesional conserva Leaflet. La instancia pública de OpenFreeMap es una dependencia externa. Puedes cambiar los estilos con `VITE_VECTOR_STYLE_LIBERTY_URL`, `VITE_VECTOR_STYLE_POSITRON_URL` y `VITE_VECTOR_STYLE_DARK_URL`. Los estilos sustitutos deben incluir sus atribuciones. [OpenFreeMap](https://openfreemap.org/quick_start/)

La dirección la escribe el cliente y confirma las coordenadas sobre el mapa. El proyecto aún no configura geocodificación directa, inversa ni autocompletado. Se puede integrar un proveedor autorizado a través de un servidor propio, por ejemplo una instancia de Nominatim o Pelias. La instancia pública de Nominatim tiene su propia política de uso. [Política de Nominatim](https://operations.osmfoundation.org/policies/nominatim/)

La pantalla muestra una distancia en línea recta cuando hay una posición reciente. Una ruta por calles y una estimación requieren un servidor de rutas, por ejemplo una instancia de Valhalla u OSRM. Para conectar un proveedor, configura `VITE_SERVICE_ROUTE_PROXY_PATH` con una ruta del mismo origen. El navegador envía un POST con el JWT de Supabase y `requestId`, `origin`, `destination` y `mode`. El proxy debe validar la sesión y la participación en la contratación, comprobar que el seguimiento está activo, y devolver `geometry` en pares `[lng, lat]`, `distanceMeters` y `durationSeconds`. Evita registrar o almacenar coordenadas en el proxy. El frontend solicita la ruta solo al elegir un modo de desplazamiento y limita los recálculos durante el movimiento.
