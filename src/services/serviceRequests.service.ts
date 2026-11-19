import { toDataError } from '@/features/auth/utils/authErrors'
import { requireSupabase } from '@/lib/supabase'
import type {
  RequestAction, RequestRole, ServiceRequestDetail, ServiceRequestInput, ServiceRequestListItem,
} from '@/types/serviceRequest'

export const REQUEST_PAGE_SIZE = 20
const SUMMARY_COLUMNS = 'id, client_name, worker_name, category_name, description, requested_date, requested_time, status, agreed_amount_bob, created_at'

const MESSAGES: Record<string, string> = {
  service_request_invalid_worker: 'Selecciona un profesional válido.',
  service_request_invalid_details: 'Revisa la descripción, la dirección y la referencia del servicio.',
  service_request_invalid_schedule: 'Elige una fecha y hora futuras, en horario de Bolivia.',
  service_request_invalid_price: 'Ingresa un importe positivo en Bs con hasta dos decimales.',
  service_request_worker_unavailable: 'El profesional ya no está disponible para recibir solicitudes nuevas.',
  service_request_invalid_category: 'El profesional ya no ofrece esta especialidad.',
  service_request_unavailable: 'La solicitud ya no está disponible.',
  service_request_changed: 'La solicitud cambió. Actualiza el detalle antes de volver a intentarlo.',
  service_request_invalid_note: 'La observación puede tener hasta 300 caracteres.',
  service_request_action_denied: 'Esta acción ya no está disponible para tu cuenta.',
}

function requestError(error: { message: string; code?: string }, fallback: string) {
  return Object.hasOwn(MESSAGES, error.message) ? new Error(MESSAGES[error.message]) : toDataError(error, fallback)
}

export const serviceRequests = {
  async list(userId: string, role: RequestRole, page: number, signal: AbortSignal): Promise<ServiceRequestListItem[]> {
    const start = page * REQUEST_PAGE_SIZE
    const { data, error } = await requireSupabase().from('service_requests')
      .select(`${SUMMARY_COLUMNS}, current_offer:service_request_offers!service_requests_current_offer(amount_bob)`)
      .eq(role === 'client' ? 'client_id' : 'worker_id', userId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(start, start + REQUEST_PAGE_SIZE)
      .abortSignal(signal)
      .overrideTypes<ServiceRequestListItem[], { merge: false }>()
    if (error) throw requestError(error, 'No se pudieron cargar tus solicitudes.')
    return data ?? []
  },

  async get(id: string, signal: AbortSignal): Promise<ServiceRequestDetail | null> {
    const { data, error } = await requireSupabase().rpc('get_service_request', { p_request_id: id }).abortSignal(signal)
    if (error?.code === '22P02') return null
    if (error) throw requestError(error, 'No se pudo cargar la solicitud.')
    return data as ServiceRequestDetail | null
  },

  async create(input: ServiceRequestInput): Promise<string> {
    const { data, error } = await requireSupabase().rpc('create_service_request', {
      p_request_id: input.requestId,
      p_worker_id: input.workerId,
      p_category_id: input.categoryId,
      p_description: input.description,
      p_requested_date: input.date,
      p_requested_time: input.time,
      p_address: input.address,
      p_reference: input.reference || null,
      p_budget_bob: input.budget,
    })
    if (error) throw requestError(error, 'No se pudo enviar la solicitud.')
    if (typeof data !== 'string') throw new Error('No se pudo confirmar el envío. Inténtalo nuevamente.')
    return data
  },

  async respond(request: ServiceRequestDetail, action: RequestAction, amount: number | null, note: string): Promise<void> {
    const { error } = await requireSupabase().rpc('respond_service_request', {
      p_request_id: request.id,
      p_expected_revision: request.revision,
      p_action: action,
      p_offer_id: request.current_offer_id,
      p_amount_bob: amount,
      p_note: note || null,
    })
    if (error) throw requestError(error, 'No se pudo guardar tu respuesta.')
  },
}
