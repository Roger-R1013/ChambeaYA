import { toDataError } from '@/features/auth/utils/authErrors'
import { requireSupabase } from '@/lib/supabase'
import type {
  CertificateInput,
  IdentityDocument,
  IdentityDocumentKind,
  VerificationStatus,
  WorkerCertificate,
} from '@/types/profile'
import { DOCUMENT_MIME_TYPES, IMAGE_MIME_TYPES, buildStoragePath, prepareImage, validateUploadFile } from '@/utils/files'

/* --------------------------------------------------------------------------
   Certificates and identity documents (migration 0005).
   - Files go to PRIVATE buckets under `<auth.uid()>/...`; tables only keep the
     storage path. Nothing is public and nothing is stored in Base64.
   - Files are opened with short-lived signed URLs (owner only, via RLS).
   - The client can NEVER mark anything as verified: review_status and
     verification_status are set by the ChambeaYA! review team.
   - Images are re-encoded before upload to remove metadata (e.g. GPS).
   -------------------------------------------------------------------------- */

const CERTIFICATES_BUCKET = 'worker-certificates'
const IDENTITY_BUCKET = 'identity-documents'
const SIGNED_URL_TTL_SECONDS = 60

/** Maximum certificates per worker. Enforced by a database trigger; mirrored for the UI. */
export const MAX_CERTIFICATES = 10

export const IDENTITY_DOCUMENT_KINDS: IdentityDocumentKind[] = ['id_front', 'id_back', 'selfie']

interface CertificateRow {
  id: string
  title: string
  issuer: string | null
  issued_on: string | null
  storage_path: string
  review_status: VerificationStatus
  created_at: string
}

interface IdentityDocumentRow {
  kind: IdentityDocumentKind
  storage_path: string
  created_at: string
}

function mapCertificate(row: CertificateRow): WorkerCertificate {
  return {
    id: row.id,
    title: row.title,
    issuer: row.issuer,
    issuedOn: row.issued_on,
    storagePath: row.storage_path,
    reviewStatus: row.review_status,
    createdAt: row.created_at,
  }
}

async function signedUrl(bucket: string, path: string): Promise<string> {
  const client = requireSupabase()
  const { data, error } = await client.storage.from(bucket).createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
  if (error || !data) throw toDataError(error, 'No se pudo abrir el archivo. Inténtalo de nuevo.')
  return data.signedUrl
}

async function removeFiles(bucket: string, paths: string[]): Promise<void> {
  if (paths.length === 0) return
  // Best effort: an orphan private file is not exposed and can be cleaned later.
  await requireSupabase().storage.from(bucket).remove(paths)
}

export const verificationService = {
  /* ------------------------------ Certificates ------------------------------ */

  async listCertificates(userId: string): Promise<WorkerCertificate[]> {
    const client = requireSupabase()
    const { data, error } = await client
      .from('worker_certificates')
      .select('id, title, issuer, issued_on, storage_path, review_status, created_at')
      .eq('worker_id', userId)
      .order('created_at', { ascending: false })
    if (error) throw toDataError(error, 'No se pudieron cargar tus certificados.')
    return ((data ?? []) as CertificateRow[]).map(mapCertificate)
  },

  async addCertificate(userId: string, { title, issuer, issuedOn, file }: CertificateInput): Promise<WorkerCertificate> {
    const invalid = validateUploadFile(file, DOCUMENT_MIME_TYPES)
    if (invalid) throw new Error(invalid)

    const client = requireSupabase()
    const prepared = await prepareImage(file, { maxDimension: 2000, type: 'image/jpeg', quality: 0.88 })
    const path = buildStoragePath(userId, 'certificate', prepared.type)

    const upload = await client.storage
      .from(CERTIFICATES_BUCKET)
      .upload(path, prepared, { contentType: prepared.type, upsert: false })
    if (upload.error) throw toDataError(upload.error, 'No se pudo subir el archivo. Inténtalo de nuevo.')

    const { data, error } = await client
      .from('worker_certificates')
      .insert({
        worker_id: userId,
        title: title.trim(),
        issuer: issuer.trim() || null,
        issued_on: issuedOn || null,
        storage_path: path,
      })
      .select('id, title, issuer, issued_on, storage_path, review_status, created_at')
      .single<CertificateRow>()
    if (error || !data) {
      await removeFiles(CERTIFICATES_BUCKET, [path])
      throw toDataError(error, 'No se pudo registrar el certificado. Inténtalo de nuevo.')
    }
    return mapCertificate(data)
  },

  async deleteCertificate(certificate: WorkerCertificate): Promise<void> {
    const client = requireSupabase()
    const { data, error } = await client.from('worker_certificates').delete().eq('id', certificate.id).select('id')
    if (error) throw toDataError(error, 'No se pudo eliminar el certificado.')
    if (!data || data.length !== 1) throw new Error('El certificado ya no existe. Recarga la página.')
    await removeFiles(CERTIFICATES_BUCKET, [certificate.storagePath])
  },

  getCertificateUrl(path: string): Promise<string> {
    return signedUrl(CERTIFICATES_BUCKET, path)
  },

  /* --------------------------- Identity documents --------------------------- */

  async listIdentityDocuments(userId: string): Promise<IdentityDocument[]> {
    const client = requireSupabase()
    const { data, error } = await client
      .from('identity_documents')
      .select('kind, storage_path, created_at')
      .eq('worker_id', userId)
    if (error) throw toDataError(error, 'No se pudieron cargar tus documentos.')
    return ((data ?? []) as IdentityDocumentRow[]).map((row) => ({
      kind: row.kind,
      storagePath: row.storage_path,
      createdAt: row.created_at,
    }))
  },

  /**
   * Uploads (or replaces) one identity image. Only allowed by RLS while the
   * worker is 'unverified' or 'rejected'.
   */
  async uploadIdentityDocument(
    userId: string,
    kind: IdentityDocumentKind,
    file: File,
    previous?: IdentityDocument,
  ): Promise<IdentityDocument> {
    const invalid = validateUploadFile(file, IMAGE_MIME_TYPES)
    if (invalid) throw new Error(invalid)

    const client = requireSupabase()
    const image = await prepareImage(file, { maxDimension: 2000, type: 'image/jpeg', quality: 0.9 })
    const path = buildStoragePath(userId, kind, image.type)

    const upload = await client.storage
      .from(IDENTITY_BUCKET)
      .upload(path, image, { contentType: image.type, upsert: false })
    if (upload.error) throw toDataError(upload.error, 'No se pudo subir la imagen. Inténtalo de nuevo.')

    // One row per (worker, kind): there is no UPDATE grant, so replace = delete + insert.
    if (previous) {
      const removal = await client.from('identity_documents').delete().eq('worker_id', userId).eq('kind', kind)
      if (removal.error) {
        await removeFiles(IDENTITY_BUCKET, [path])
        throw toDataError(removal.error, 'No se pudo reemplazar la imagen.')
      }
    }

    const { data, error } = await client
      .from('identity_documents')
      .insert({ worker_id: userId, kind, storage_path: path })
      .select('kind, storage_path, created_at')
      .single<IdentityDocumentRow>()
    if (error || !data) {
      await removeFiles(IDENTITY_BUCKET, [path])
      if (previous) {
        // Restore the previous pointer so the worker does not lose the earlier upload.
        await client.from('identity_documents').insert({ worker_id: userId, kind, storage_path: previous.storagePath })
      }
      throw toDataError(error, 'No se pudo guardar la imagen. Inténtalo de nuevo.')
    }

    if (previous) await removeFiles(IDENTITY_BUCKET, [previous.storagePath])
    return { kind: data.kind, storagePath: data.storage_path, createdAt: data.created_at }
  },

  getIdentityDocumentUrl(path: string): Promise<string> {
    return signedUrl(IDENTITY_BUCKET, path)
  },

  /** Sends the request to MANUAL review. Never marks the identity as verified. */
  async submitIdentityVerification(): Promise<VerificationStatus> {
    const client = requireSupabase()
    const { data, error } = await client.rpc('submit_identity_verification')
    if (error) throw toDataError(error, 'No se pudo enviar la solicitud. Inténtalo de nuevo.')
    return (data as VerificationStatus | null) ?? 'pending'
  },
}
