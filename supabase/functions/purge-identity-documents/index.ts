/* =============================================================================
   ChambeaYA! - Edge Function: purge-identity-documents (retention policy D3)

   Deletes expired identity images and orphan private files through the
   Storage API (Supabase blocks direct DELETE on storage.objects), then removes
   the table rows with finalize_storage_purge(). See migration 0006.

   Security:
     * Deploy with JWT verification disabled and protect it with a dedicated
       secret:  supabase functions deploy purge-identity-documents --no-verify-jwt
               supabase secrets set PURGE_CRON_SECRET=<random 32+ chars>
     * Callers must send  Authorization: Bearer <PURGE_CRON_SECRET>.
     * Responses and logs contain only counts: never paths or personal data.

   No external imports on purpose (plain fetch against PostgREST and Storage).
   ============================================================================= */

declare const Deno: {
  env: { get(name: string): string | undefined }
  serve(handler: (request: Request) => Response | Promise<Response>): void
}

interface DueObject {
  bucket_id: string
  object_name: string
  reason: string
}

const BATCH_SIZE = 100
const ALLOWED_BUCKETS = new Set(['identity-documents', 'worker-certificates'])

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

async function sha256(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))
}

/** Constant-time comparison (hashing first equalises the length). */
async function safeEqual(a: string, b: string): Promise<boolean> {
  const [x, y] = await Promise.all([sha256(a), sha256(b)])
  let diff = 0
  for (let i = 0; i < x.length; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0)
  return diff === 0
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const secret = Deno.env.get('PURGE_CRON_SECRET') ?? ''
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (secret.length < 32 || !supabaseUrl || !serviceKey) return json({ error: 'not_configured' }, 500)

  const auth = request.headers.get('Authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!(await safeEqual(token, secret))) return json({ error: 'unauthorized' }, 401)

  const headers: Record<string, string> = { apikey: serviceKey, 'Content-Type': 'application/json' }
  // Legacy service_role keys are JWTs; new secret keys (sb_secret_...) only go in `apikey`.
  if (serviceKey.startsWith('eyJ')) headers.Authorization = `Bearer ${serviceKey}`

  const rpc = (name: string, body: unknown) =>
    fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, { method: 'POST', headers, body: JSON.stringify(body) })

  const dueResponse = await rpc('storage_objects_due_for_purge', {})
  if (!dueResponse.ok) {
    console.error('purge: could not list due objects', dueResponse.status)
    return json({ error: 'list_failed' }, 502)
  }
  const due = ((await dueResponse.json()) as DueObject[]).filter((item) => ALLOWED_BUCKETS.has(item.bucket_id))

  const byBucket = new Map<string, string[]>()
  for (const item of due) byBucket.set(item.bucket_id, [...(byBucket.get(item.bucket_id) ?? []), item.object_name])

  const result = { due: due.length, filesRemoved: 0, rowsRemoved: 0, failedBatches: 0 }

  for (const [bucket, paths] of byBucket) {
    const removed: string[] = []
    for (let start = 0; start < paths.length; start += BATCH_SIZE) {
      const batch = paths.slice(start, start + BATCH_SIZE)
      const response = await fetch(`${supabaseUrl}/storage/v1/object/${bucket}`, {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ prefixes: batch }),
      })
      if (response.ok) {
        removed.push(...batch)
      } else {
        result.failedBatches++
        console.error('purge: storage batch failed', bucket, response.status)
      }
    }
    result.filesRemoved += removed.length

    if (removed.length > 0) {
      // Only rows whose file no longer exists are deleted (checked in SQL).
      const finalize = await rpc('finalize_storage_purge', { p_bucket: bucket, p_paths: removed })
      if (finalize.ok) result.rowsRemoved += Number(await finalize.json()) || 0
      else {
        result.failedBatches++
        console.error('purge: finalize failed', bucket, finalize.status)
      }
    }
  }

  console.log('purge: done', JSON.stringify(result))
  return json(result, result.failedBatches > 0 ? 207 : 200)
})

