# Administración de ChambeaYA!

## Activación por el propietario

1. Aplica la migración `20261118000800_administration_professional_documents.sql` después de la 0007 en el proyecto correcto. Conserva los registros y los archivos privados existentes. Los documentos anteriores aparecen como «Tipo sin especificar».
2. Despliega `open-review-file` en el mismo proyecto. La función valida el token del usuario con Supabase Auth, consulta su permiso vigente en PostgreSQL y firma enlaces por 60 segundos. Usa `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` del entorno de la función. La clave privilegiada se usa solamente en servidor.

   ```powershell
   supabase functions deploy open-review-file --project-ref <referencia-del-proyecto> --no-verify-jwt
   ```

3. En **Authentication → Users**, verifica la identidad y el UUID de la cuenta confirmada a la que deseas dar acceso. Desde **SQL Editor**, como propietario, sustituye el UUID de este bloque y ejecútalo explícitamente. El resultado debe devolver esa cuenta cuando se cree la autorización.

   ```sql
   insert into public.administrators (user_id)
   select id from auth.users
   where id = '<UUID_DE_LA_CUENTA_CONFIRMADA>'::uuid
     and email_confirmed_at is not null
   on conflict (user_id) do nothing
   returning user_id, granted_at;
   ```

4. Inicia sesión con la cuenta autorizada y abre `/admin`. El acceso también aparece en su menú de perfil si ya tiene tipo de cuenta. El permiso es independiente de los roles de cliente y trabajador.

## Comprobaciones manuales

- Abre `/admin` con una cuenta sin permiso y confirma que las bandejas y los archivos quedan inaccesibles.
- Registra cada tipo de respaldo laboral, incluyendo una recomendación sin emisor ni fecha. Confirma que los documentos antiguos y sus archivos siguen disponibles.
- Revisa un documento, comprueba su historial e intenta resolver la misma solicitud desde dos sesiones de administración. Solo la primera decisión debe guardarse.
- Abre los archivos de una solicitud de identidad pendiente. Aprueba o rechaza con justificación y comprueba los eventos y el estado que ve el trabajador. Los enlaces ya emitidos caducan a los 60 segundos. La retención de identidad de la 0006 sigue aplicando.
