# Seguimiento de contrataciones

## Activación

1. Aplica 0010 (solicitudes), 0011 (recorridos) y 0012 (actividad de seguimiento), en ese orden. Si 0010 y 0011 ya están aplicadas, ejecuta únicamente 0012 antes de publicar la versión actualizada del frontend. La publicación `supabase_realtime` contiene los metadatos de `service_journeys`. Las coordenadas y el identificador de la sesión permanecen en una tabla privada y solo se gestionan mediante RPC.
2. En Supabase, comprueba que Realtime tenga habilitado Postgres Changes para `service_journeys`. El canal privado `service-journey:<UUID>` verifica la membresía de la solicitud. La pantalla visible consulta la RPC cada 15 segundos si Realtime está desconectado, con espera creciente tras errores. Si el SDK no recupera el canal, la aplicación espera, comprueba la autorización mediante RPC y abre un canal de reemplazo. Al volver la conexión o la vista, se valida el acceso antes de mostrar coordenadas precisas.
3. Habilita Supabase Cron y programa la limpieza con el propietario de la base, una vez por minuto. Conserva el mismo trabajo si ya está programado. La sesión vence tras 65 segundos sin una publicación GPS válida o señal de actividad aceptada. Tras vencer, la RPC deja de entregar coordenadas de inmediato y Cron elimina la última posición del almacenamiento activo.

   ```sql
   select cron.schedule(
     'chambeaya-expired-service-journeys',
     '* * * * *',
     'select public.purge_inactive_service_journeys()'
   );
   ```

4. Con dos cuentas, confirma una contratación. Desde su detalle, el cliente confirma el destino y el trabajador pulsa **Estoy en camino**. Mantén la pantalla del trabajador abierta y permanece detenido al menos dos minutos, luego camina y confirma que el cliente vea lecturas nuevas sin recargar. Si el GPS pierde señal durante más de 45 segundos y la sesión sigue comunicándose, el cliente conserva la última posición y ve «Ubicación sin actualizar» hasta que se obtenga una lectura nueva. Comprueba también que una sesión duplicada se rechace y que una cuenta ajena no pueda acceder. Prueba **Detener seguimiento**, **He llegado** y la cancelación en una contratación separada. La cancelación conserva el acuerdo original como historial e impide al trabajador seguir consultando la dirección.

## Ajustes y recuperación

- Con la pantalla visible y conexión, el trabajador mantiene un observador GPS. Tras 28 segundos sin una lectura válida, se solicita una lectura nueva, con una sola solicitud de respaldo en curso. Los envíos guardados del trabajador se separan al menos 8 segundos con movimiento significativo o 28 segundos con movimiento mínimo. El umbral de movimiento toma en cuenta la precisión de ambas lecturas.
- Si pasan unos 20 segundos sin renovar la sesión mediante GPS, la aplicación envía una señal de actividad. Esta señal conserva intacta la hora de la última lectura. El cliente indica la precisión estimada, mantiene la última posición autorizada cuando queda desactualizada y deja de calcular rutas o estimaciones hasta recibir una lectura reciente.
- Los ajustes del frontend están en `src/features/serviceJourney/tracking.ts`. Ajusta la cadencia con pruebas en dispositivos reales. El servidor verifica que los puntos lleguen en orden, con hasta 100 m de margen de precisión y menos de 45 segundos de antigüedad. La vigencia de 65 segundos y el límite de escrituras de la RPC se configuran en SQL.
- Con ambas pantallas abiertas, corta y restablece la conexión antes del vencimiento en cada dispositivo. Comprueba que se retiran temporalmente las coordenadas durante la revalidación, que el cliente vuelve a recibir puntos y que el trabajador no debe reiniciar la sesión. Repite con un corte superior a 65 segundos desde la última actividad aceptada. En ese caso, la sesión anterior debe quedar pausada y el trabajador debe pulsar **Estoy en camino** para abrir otra.

La geolocalización web requiere HTTPS o localhost y permiso del navegador. Bloquear la pantalla o cambiar de aplicación puede suspender el GPS. Reabrir o recargar la pantalla requiere iniciar el seguimiento de forma explícita. El seguimiento con pantalla bloqueada o en segundo plano durante periodos prolongados requeriría una aplicación móvil con permisos de ubicación en segundo plano y servicios sujetos a las reglas de Android o iOS. Terminar el seguimiento elimina la última posición y conserva los tiempos y el estado del recorrido.

## Mapas y proveedores

Buscar, seleccionar destino y seguir una contratación usan MapLibre con OpenFreeMap. Los estilos Liberty, Positron y Dark conservan la atribución cartográfica. El mapa de disponibilidad del perfil profesional conserva Leaflet. La instancia pública de OpenFreeMap es una dependencia externa. Puedes cambiar los estilos con `VITE_VECTOR_STYLE_LIBERTY_URL`, `VITE_VECTOR_STYLE_POSITRON_URL` y `VITE_VECTOR_STYLE_DARK_URL`. Los estilos sustitutos deben incluir sus atribuciones. [OpenFreeMap](https://openfreemap.org/quick_start/)

La dirección la escribe el cliente y confirma las coordenadas sobre el mapa. El proyecto aún no configura geocodificación directa, inversa ni autocompletado. Se puede integrar un proveedor autorizado a través de un servidor propio, por ejemplo una instancia de Nominatim o Pelias. La instancia pública de Nominatim tiene su propia política de uso. [Política de Nominatim](https://operations.osmfoundation.org/policies/nominatim/)

La pantalla muestra una distancia en línea recta cuando hay una posición reciente. Una ruta por calles y una estimación requieren un servidor de rutas, por ejemplo una instancia de Valhalla u OSRM. Para conectar un proveedor, configura `VITE_SERVICE_ROUTE_PROXY_PATH` con una ruta del mismo origen. El navegador envía un POST con el JWT de Supabase y `requestId`, `origin`, `destination` y `mode`. El proxy debe validar la sesión y la participación en la contratación, comprobar que el seguimiento está activo, y devolver `geometry` en pares `[lng, lat]`, `distanceMeters` y `durationSeconds`. Evita registrar o almacenar coordenadas en el proxy. El frontend solicita la ruta solo al elegir un modo de desplazamiento y limita los recálculos durante el movimiento.
