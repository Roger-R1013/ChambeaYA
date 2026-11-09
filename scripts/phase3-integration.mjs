// =============================================================================
// ChambeaYA! - Phase 3 integration test against the REAL Supabase project.
//
// Uses ONLY the public key from .env and a real TEST worker account whose
// credentials live in .env.test.local (git-ignored):
//   TEST_WORKER_EMAIL=...
//   TEST_WORKER_PASSWORD=...
// Never prints credentials, tokens or private paths.
//
// Run:  node scripts/phase3-integration.mjs
// Re-runnable. Identity flow:
//   unverified/rejected -> uploads 3 images, checks locks, submits (-> pending)
//   pending             -> checks that everything is locked
//   rejected            -> also checks that the reviewer note is visible
// =============================================================================
import { readFileSync, existsSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

function loadEnv(file) {
  if (!existsSync(file)) return {}
  return Object.fromEntries(
    readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .filter((line) => /^[A-Z_]+=/.test(line))
      .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1).trim()]),
  )
}

const env = { ...loadEnv('.env'), ...loadEnv('.env.test.local') }
const URL_ = env.VITE_SUPABASE_URL
const KEY = env.VITE_SUPABASE_ANON_KEY
if (!URL_ || !KEY) throw new Error('Falta VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY en .env')
if (!env.TEST_WORKER_EMAIL || !env.TEST_WORKER_PASSWORD) {
  console.error('Falta .env.test.local con TEST_WORKER_EMAIL y TEST_WORKER_PASSWORD (cuenta de trabajador de prueba).')
  process.exit(2)
}

const options = { auth: { persistSession: false, autoRefreshToken: false } }
const anon = createClient(URL_, KEY, options)
const db = createClient(URL_, KEY, options)

const results = []
function record(area, name, passed, detail = '') {
  results.push({ area, name, passed })
  console.log(`${passed ? 'OK  ' : 'FAIL'} [${area}] ${name}${detail && !passed ? ` -> ${detail}` : ''}`)
}
async function expectOk(area, name, fn) {
  try {
    const value = await fn()
    record(area, name, true)
    return value
  } catch (error) {
    record(area, name, false, error?.message ?? String(error))
    return undefined
  }
}
async function expectFail(area, name, fn, pattern) {
  try {
    await fn()
    record(area, name, false, 'la operación debía fallar y se permitió')
  } catch (error) {
    const message = error?.message ?? String(error)
    record(area, name, !pattern || pattern.test(message), message)
  }
}
const must = ({ data, error }) => {
  if (error) throw new Error(`${error.code ?? ''} ${error.message}`.trim())
  return data
}
const mustRows = (result, count = 1) => {
  const data = must(result)
  if (!Array.isArray(data) || data.length !== count) throw new Error(`0 filas afectadas (RLS) - esperado ${count}`)
  return data
}

// Minimal valid files (bytes only, generated in memory).
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n')
const rid = () => crypto.randomUUID()

// ----------------------------------------------------------------------------
const session = must(await db.auth.signInWithPassword({ email: env.TEST_WORKER_EMAIL, password: env.TEST_WORKER_PASSWORD }))
const uid = session.user.id
console.log('Sesión iniciada con la cuenta de prueba.\n')

const profile = must(await db.from('profiles').select('first_name, last_name, phone, account_type, avatar_url').eq('id', uid).single())
if (profile.account_type !== 'worker') {
  console.error('La cuenta de prueba debe ser de tipo trabajador.')
  process.exit(2)
}

// ---------------------------------------------------------------- A. Personal
await expectOk('A', 'guardar nombre, apellido y teléfono', async () => {
  mustRows(await db.from('profiles').update({ first_name: 'Prueba', last_name: 'Integración', phone: '76543210' }).eq('id', uid).select('id'))
  const back = must(await db.from('profiles').select('first_name, last_name, phone').eq('id', uid).single())
  if (back.first_name !== 'Prueba' || back.last_name !== 'Integración' || back.phone !== '76543210') throw new Error('no se recuperaron los valores')
})
await expectFail('A', 'rechaza teléfono inválido', async () => must(await db.from('profiles').update({ phone: '123' }).eq('id', uid)), /phone|check/i)
await expectFail('A', 'no permite cambiar account_type', async () => must(await db.from('profiles').update({ account_type: 'client' }).eq('id', uid)), /account_type|permission/i)
await expectOk('A', 'restaurar datos originales', async () =>
  mustRows(await db.from('profiles').update({ first_name: profile.first_name, last_name: profile.last_name, phone: profile.phone }).eq('id', uid).select('id')),
)

// ----------------------------------------------------- B. Professional profile
const zones = await expectOk('B', 'leer zonas de trabajo', async () => {
  const data = must(await db.from('service_zones').select('id').eq('is_active', true))
  if (data.length === 0) throw new Error('sin zonas')
  return data
})
const categories = must(await db.from('categories').select('id').eq('is_active', true).limit(2))
await expectOk('B', 'guardar profesión, descripción, experiencia, zona y precio', async () => {
  mustRows(
    await db
      .from('worker_profiles')
      .update({
        profession: 'Electricista domiciliario',
        description: 'Instalaciones eléctricas domiciliarias, tableros y reparaciones con garantía de trabajo.',
        experience_years: 7,
        service_radius_km: 12,
        availability_status: 'available',
        service_zone_id: zones?.[0]?.id,
        pricing_mode: 'per_hour',
        base_rate_bob: 80,
      })
      .eq('id', uid)
      .select('id'),
  )
  const back = must(await db.from('worker_profiles').select('profession, experience_years, service_zone_id, pricing_mode, base_rate_bob').eq('id', uid).single())
  if (back.service_zone_id !== zones?.[0]?.id || back.pricing_mode !== 'per_hour' || Number(back.base_rate_bob) !== 80) throw new Error('valores no recuperados')
})
await expectOk('B', 'guardar categorías (RPC set_worker_categories)', async () => {
  const ids = categories.map((c) => c.id)
  must(await db.rpc('set_worker_categories', { p_category_ids: ids }))
  const back = must(await db.from('worker_categories').select('category_id').eq('worker_id', uid))
  if (back.length !== ids.length) throw new Error('categorías no recuperadas')
})
await expectFail('B', 'rechaza precio con modo "a cotizar"', async () =>
  must(await db.from('worker_profiles').update({ pricing_mode: 'quote', base_rate_bob: 50 }).eq('id', uid)), /rate|check/i)
await expectFail('B', 'no permite cambiar verification_status', async () =>
  must(await db.from('worker_profiles').update({ verification_status: 'verified' }).eq('id', uid)), /verification_status|permission/i)

// -------------------------------------------------------------- C. Avatar
const avatarPath = `${uid}/avatar-${rid()}.png`
await expectOk('C', 'subir foto a su carpeta', async () => must(await db.storage.from('avatars').upload(avatarPath, PNG, { contentType: 'image/png' })))
const avatarUrl = db.storage.from('avatars').getPublicUrl(avatarPath).data.publicUrl
await expectOk('C', 'vincular foto al perfil', async () => mustRows(await db.from('profiles').update({ avatar_url: avatarUrl }).eq('id', uid).select('id')))
await expectOk('C', 'foto accesible públicamente (es pública por diseño)', async () => {
  const res = await fetch(avatarUrl)
  if (res.status !== 200) throw new Error(`HTTP ${res.status}`)
})
await expectFail('C', 'rechaza avatar_url de dominio externo', async () =>
  must(await db.from('profiles').update({ avatar_url: `https://evil.example.com/storage/v1/object/public/avatars/${avatarPath}` }).eq('id', uid)), /invalid_avatar_url/)
await expectFail('C', 'no permite subir a carpeta ajena', async () =>
  must(await db.storage.from('avatars').upload(`${rid()}/x.png`, PNG, { contentType: 'image/png' })), /row-level security|unauthorized|403/i)
await expectFail('C', 'rechaza archivos de más de 5 MB', async () =>
  must(await db.storage.from('avatars').upload(`${uid}/big-${rid()}.png`, Buffer.alloc(5 * 1024 * 1024 + 10), { contentType: 'image/png' })), /size|exceeded|413|large/i)
await expectFail('C', 'rechaza formatos no permitidos', async () =>
  must(await db.storage.from('avatars').upload(`${uid}/x-${rid()}.pdf`, PDF, { contentType: 'application/pdf' })), /mime|type|415|not supported/i)
await expectOk('C', 'restaurar foto original y borrar la de prueba', async () => {
  mustRows(await db.from('profiles').update({ avatar_url: profile.avatar_url }).eq('id', uid).select('id'))
  must(await db.storage.from('avatars').remove([avatarPath]))
})

// ---------------------------------------------------------- D. Certificates
const certPath = `${uid}/certificate-${rid()}.pdf`
let certId
await expectOk('D', 'subir certificado PDF al bucket privado', async () =>
  must(await db.storage.from('worker-certificates').upload(certPath, PDF, { contentType: 'application/pdf' })))
await expectOk('D', 'registrar certificado', async () => {
  const row = must(await db.from('worker_certificates').insert({ worker_id: uid, title: 'Certificado de prueba', issuer: 'INFOCAL', issued_on: '2024-05-10', storage_path: certPath }).select('id, review_status').single())
  certId = row.id
  if (row.review_status !== 'pending') throw new Error(`review_status inicial ${row.review_status}`)
})
await expectOk('D', 'ver certificado con URL firmada (dueño)', async () => {
  const { signedUrl } = must(await db.storage.from('worker-certificates').createSignedUrl(certPath, 60))
  const res = await fetch(signedUrl)
  if (res.status !== 200) throw new Error(`HTTP ${res.status}`)
})
await expectOk('D', 'certificado NO accesible públicamente', async () => {
  const res = await fetch(`${URL_}/storage/v1/object/public/worker-certificates/${certPath}`)
  if (res.status < 400) throw new Error(`HTTP ${res.status}`)
})
await expectOk('D', 'anónimo no puede leer la tabla de certificados', async () => {
  const { data, error } = await anon.from('worker_certificates').select('id').limit(1)
  if (!error && data.length > 0) throw new Error('filas visibles para anon')
})
await expectFail('D', 'no permite marcar el certificado como aprobado', async () =>
  must(await db.from('worker_certificates').update({ review_status: 'verified' }).eq('id', certId)), /permission/i)
await expectFail('D', 'rechaza registro sin archivo real (H4)', async () =>
  must(await db.from('worker_certificates').insert({ worker_id: uid, title: 'Falso', storage_path: `${uid}/certificate-${rid()}.pdf` })), /row-level security/i)
await expectOk('D', 'eliminar certificado y su archivo', async () => {
  mustRows(await db.from('worker_certificates').delete().eq('id', certId).select('id'))
  must(await db.storage.from('worker-certificates').remove([certPath]))
})

// --------------------------------------------------------- E. Identity
await expectFail('E', 'funciones de purga NO ejecutables por usuarios', async () => must(await db.rpc('storage_objects_due_for_purge')), /permission|not find|42501/i)
await expectFail('E', 'finalize_storage_purge NO ejecutable por usuarios', async () =>
  must(await db.rpc('finalize_storage_purge', { p_bucket: 'identity-documents', p_paths: [] })), /permission|not find|42501/i)

const wp = must(await db.from('worker_profiles').select('verification_status, verification_note').eq('id', uid).single())
console.log(`\nEstado de verificación actual: ${wp.verification_status}`)

if (wp.verification_status === 'rejected') {
  record('E', 'motivo de rechazo visible para el trabajador', Boolean(wp.verification_note), 'verification_note vacío')
}

if (wp.verification_status === 'unverified' || wp.verification_status === 'rejected') {
  const existing = must(await db.from('identity_documents').select('kind, storage_path').eq('worker_id', uid))
  if (existing.length < 3) {
    await expectFail('E', 'no permite enviar documentación incompleta', async () => must(await db.rpc('submit_identity_verification')), /identity_documents_incomplete/)
  }
  for (const kind of ['id_front', 'id_back', 'selfie']) {
    const previous = existing.find((d) => d.kind === kind)
    const path = `${uid}/${kind}-${rid()}.png`
    await expectOk('E', `subir ${kind}`, async () => {
      must(await db.storage.from('identity-documents').upload(path, PNG, { contentType: 'image/png' }))
      if (previous) must(await db.from('identity_documents').delete().eq('worker_id', uid).eq('kind', kind))
      must(await db.from('identity_documents').insert({ worker_id: uid, kind, storage_path: path }))
      if (previous) must(await db.storage.from('identity-documents').remove([previous.storage_path]))
    })
  }
  await expectOk('E', 'documento de identidad NO accesible públicamente', async () => {
    const doc = must(await db.from('identity_documents').select('storage_path').eq('worker_id', uid).limit(1).single())
    const res = await fetch(`${URL_}/storage/v1/object/public/identity-documents/${doc.storage_path}`)
    if (res.status < 400) throw new Error(`HTTP ${res.status}`)
  })
  await expectOk('E', 'enviar a revisión (RPC) -> pending', async () => {
    const status = must(await db.rpc('submit_identity_verification'))
    if (status !== 'pending') throw new Error(`estado ${status}`)
  })
}

const after = must(await db.from('worker_profiles').select('verification_status, verification_submitted_at').eq('id', uid).single())
if (after.verification_status === 'pending') {
  record('E', 'fecha de envío registrada', Boolean(after.verification_submitted_at))
  const events = must(await db.from('identity_verification_events').select('event').eq('worker_id', uid))
  record('E', 'evento "submitted" en el historial', events.some((e) => e.event === 'submitted'))
  await expectFail('E', 'bloqueado en revisión: no puede subir archivos', async () =>
    must(await db.storage.from('identity-documents').upload(`${uid}/selfie-${rid()}.png`, PNG, { contentType: 'image/png' })), /row-level security|unauthorized|403/i)
  await expectOk('E', 'bloqueado en revisión: no puede borrar documentos', async () => {
    const data = must(await db.from('identity_documents').delete().eq('worker_id', uid).select('kind'))
    if (data.length > 0) throw new Error('se borraron documentos')
  })
  await expectFail('E', 'bloqueado en revisión: no puede reenviar', async () => must(await db.rpc('submit_identity_verification')), /verification_not_editable/)
  await expectFail('E', 'no puede aprobarse a sí mismo', async () =>
    must(await db.from('worker_profiles').update({ verification_status: 'verified' }).eq('id', uid)), /verification_status|permission/i)
}

await db.auth.signOut()
const failed = results.filter((r) => !r.passed)
console.log(`\nResultado: ${results.length - failed.length}/${results.length} comprobaciones correctas.`)
process.exit(failed.length > 0 ? 1 : 0)

