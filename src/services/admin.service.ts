import { FunctionsHttpError } from '@supabase/supabase-js'
import { toDataError } from '@/features/auth/utils/authErrors'
import { requireSupabase } from '@/lib/supabase'
import type { IdentityDocumentKind, ProfessionalDocumentKind, VerificationStatus } from '@/types/profile'

export const ADMIN_PAGE_SIZE = 25

interface AdminMetrics {
  workers: number
  clients: number
  identity_pending: number
  documents_pending: number
  documents_approved: number
  documents_rejected: number
}

export interface AdminDocument {
  id: string
  worker_id: string
  worker_name: string | null
  title: string
  document_kind: ProfessionalDocumentKind | null
  issuer: string | null
  issued_on: string | null
  created_at: string | null
  review_status: VerificationStatus
  reviewed_at: string | null
  reviewer_id: string | null
  reviewer_name: string | null
  note: string | null
  file_available: boolean
}

export interface AdminIdentityRequest {
  worker_id: string
  worker_name: string
  request_id: string
  submitted_at: string | null
  available_files: IdentityDocumentKind[]
}

export interface AdminWorker {
  id: string
  name: string
  profession: string | null
  experience_years: number | null
  specialties: string[]
  verification_status: VerificationStatus
  documents_pending: number
  documents_approved: number
  documents_rejected: number
}

type ReviewFile = { documentId: string } | { workerId: string; requestId: string; kind: IdentityDocumentKind }
type AdminListRpc = 'admin_documents' | 'admin_identity_queue' | 'admin_workers'

async function loadPage<T>(
  rpc: AdminListRpc,
  params: { p_offset: number; p_history?: boolean },
  signal: AbortSignal,
): Promise<T[]> {
  const { data, error } = await requireSupabase().rpc(rpc, params).abortSignal(signal)
  if (error) throw toDataError(error, 'No se pudo cargar la lista administrativa.')
  return (data ?? []) as T[]
}

export const adminService = {
  async isAdmin(signal: AbortSignal): Promise<boolean> {
    const { data, error } = await requireSupabase().rpc('is_admin').abortSignal(signal)
    if (error) throw toDataError(error, 'No se pudieron comprobar tus permisos.')
    return data === true
  },

  async getMetrics(signal: AbortSignal): Promise<AdminMetrics> {
    const { data, error } = await requireSupabase().rpc('admin_dashboard').abortSignal(signal).single<AdminMetrics>()
    if (error || !data) throw toDataError(error, 'No se pudieron cargar los indicadores.')
    return data
  },

  listDocuments(history: boolean, offset: number, signal: AbortSignal) {
    return loadPage<AdminDocument>('admin_documents', { p_history: history, p_offset: offset }, signal)
  },

  listIdentityRequests(offset: number, signal: AbortSignal) {
    return loadPage<AdminIdentityRequest>('admin_identity_queue', { p_offset: offset }, signal)
  },

  listWorkers(offset: number, signal: AbortSignal) {
    return loadPage<AdminWorker>('admin_workers', { p_offset: offset }, signal)
  },

  async reviewDocument(id: string, approve: boolean, note: string): Promise<void> {
    const { error } = await requireSupabase().rpc('admin_review_document', {
      p_document_id: id, p_approve: approve, p_note: note,
    })
    if (error) throw toDataError(error, 'No se pudo registrar la revisión del documento.')
  },

  async reviewIdentity(workerId: string, requestId: string, approve: boolean, note: string): Promise<void> {
    const { error } = await requireSupabase().rpc('admin_review_identity', {
      p_worker_id: workerId, p_request_id: requestId, p_approve: approve, p_note: note,
    })
    if (error) throw toDataError(error, 'No se pudo registrar la revisión de identidad.')
  },

  async getFileUrl(file: ReviewFile): Promise<string> {
    const { data, error } = await requireSupabase().functions.invoke<{ signedUrl: string }>('open-review-file', { body: file })
    if (error instanceof FunctionsHttpError) {
      if (error.context.status === 401) throw new Error('Tu sesión expiró. Inicia sesión de nuevo.')
      if (error.context.status === 403) throw new Error('Se requieren permisos administrativos para abrir el archivo.')
      if (error.context.status === 404) throw new Error('El archivo ya no está disponible para revisión.')
    }
    if (error || !data?.signedUrl) throw new Error('No se pudo abrir el archivo privado. Inténtalo de nuevo.')
    return data.signedUrl
  },
}
