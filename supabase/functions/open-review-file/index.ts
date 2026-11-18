// Deploy with --no-verify-jwt. Auth validates the caller's access token below
// before the service role can resolve or sign any document.
declare const Deno: {
  env: { get(name: string): string | undefined }
  serve(handler: (request: Request) => Response | Promise<Response>): void
}

const SIGNED_URL_TTL_SECONDS = 60
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const IDENTITY_KINDS = new Set(['id_front', 'id_back', 'selfie'])
const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-region, x-supabase-api-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
}

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: HEADERS })
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value)
}

function getTarget(body: unknown) {
  if (!body || typeof body !== 'object') return null
  if ('documentId' in body && isUuid(body.documentId)) {
    return { p_document_id: body.documentId }
  }
  if (
    'workerId' in body && isUuid(body.workerId) &&
    'requestId' in body && isUuid(body.requestId) &&
    'kind' in body && typeof body.kind === 'string' && IDENTITY_KINDS.has(body.kind)
  ) {
    return { p_worker_id: body.workerId, p_request_id: body.requestId, p_kind: body.kind }
  }
  return null
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: HEADERS })
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const authorization = request.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401)

  const projectUrl = Deno.env.get('SUPABASE_URL')?.replace(/\/+$/, '')
  const publicKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!projectUrl || !publicKey || !serviceKey) return json({ error: 'not_configured' }, 500)

  const target = getTarget(await request.json().catch(() => null))
  if (!target) return json({ error: 'invalid_target' }, 400)

  try {
    const userResponse = await fetch(`${projectUrl}/auth/v1/user`, {
      headers: { apikey: publicKey, Authorization: authorization },
    })
    if (!userResponse.ok) {
      return json({ error: 'user_unavailable' }, userResponse.status >= 500 ? 502 : 401)
    }
    const user = (await userResponse.json()) as { id?: unknown }
    if (!isUuid(user.id)) return json({ error: 'unauthorized' }, 401)

    const headers: Record<string, string> = { apikey: serviceKey, 'Content-Type': 'application/json' }
    if (serviceKey.startsWith('eyJ')) headers.Authorization = `Bearer ${serviceKey}`
    const lookup = await fetch(`${projectUrl}/rest/v1/rpc/admin_review_file`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...target, p_reviewer: user.id }),
    })
    if (!lookup.ok) {
      if (lookup.status === 401 || lookup.status === 403) return json({ error: 'forbidden' }, 403)
      return json({ error: 'lookup_failed' }, 502)
    }
    const [object] = (await lookup.json()) as { bucket_id: string; object_name: string }[]
    if (!object) return json({ error: 'file_unavailable' }, 404)
    const bucket = 'p_document_id' in target ? 'worker-certificates' : 'identity-documents'
    if (object.bucket_id !== bucket || !object.object_name) return json({ error: 'lookup_failed' }, 502)

    const objectPath = object.object_name.split('/').map(encodeURIComponent).join('/')
    const signed = await fetch(`${projectUrl}/storage/v1/object/sign/${bucket}/${objectPath}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ expiresIn: SIGNED_URL_TTL_SECONDS }),
    })
    if (!signed.ok) return json({ error: 'file_unavailable' }, signed.status === 404 ? 404 : 502)
    const data = (await signed.json()) as { signedURL?: string }
    if (!data.signedURL?.startsWith(`/object/sign/${bucket}/`)) return json({ error: 'signing_failed' }, 502)

    return json({ signedUrl: `${projectUrl}/storage/v1${data.signedURL}` })
  } catch {
    return json({ error: 'review_file_failed' }, 502)
  }
})
