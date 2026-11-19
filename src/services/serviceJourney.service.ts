import { toDataError } from '@/features/auth/utils/authErrors'
import { requireSupabase } from '@/lib/supabase'
import type { GeoPoint, GeoPosition } from '@/types/geo'
import type { JourneyEnd, JourneySnapshot } from '@/types/serviceJourney'

const MESSAGES: Record<string, string> = {
  journey_unavailable: 'Este recorrido no está disponible para tu cuenta.',
  journey_invalid_destination: 'Elige un punto dentro del área de Santa Cruz y revisa la referencia.',
  journey_destination_locked: 'El destino ya no se puede cambiar después de iniciar el recorrido.',
  journey_destination_required: 'El cliente debe confirmar el destino antes de iniciar el recorrido.',
  journey_ended: 'El seguimiento de esta sesión terminó. Actualiza la pantalla.',
  journey_session_active: 'Ya hay un dispositivo compartiendo la ubicación de este recorrido.',
}

export class JourneyError extends Error {
  override name = 'JourneyError'
}

function asJourneyError(error: { message: string; code?: string }) {
  const message = MESSAGES[error.message]
  if (Object.hasOwn(MESSAGES, error.message) && message) return new JourneyError(message)
  return toDataError(error, 'No se pudo actualizar el recorrido. Comprueba tu conexión.')
}

async function mutate(rpc: 'set_service_destination' | 'start_service_journey' | 'publish_service_position' | 'finish_service_journey', params: Record<string, unknown>) {
  const { data, error } = await requireSupabase().rpc(rpc, params)
  if (error) throw asJourneyError(error)
  return data
}

export const serviceJourney = {
  async get(id: string, signal: AbortSignal): Promise<JourneySnapshot | null> {
    const { data, error } = await requireSupabase().rpc('get_service_journey', { p_request_id: id }).abortSignal(signal)
    if (error?.code === '22P02') return null
    if (error) throw asJourneyError(error)
    return data as JourneySnapshot | null
  },
  setDestination(id: string, point: GeoPoint, reference: string) {
    return mutate('set_service_destination', { p_request_id: id, p_lat: point.lat, p_lng: point.lng, p_reference: reference })
  },
  start(id: string, session: string) {
    return mutate('start_service_journey', { p_request_id: id, p_session_id: session })
  },
  async publish(id: string, session: string, position: GeoPosition): Promise<boolean> {
    return (await mutate('publish_service_position', {
      p_request_id: id, p_session_id: session, p_lat: position.lat, p_lng: position.lng,
      p_accuracy: position.accuracy, p_captured_at: new Date(position.timestamp).toISOString(),
    })) === true
  },
  finish(id: string, action: JourneyEnd, session?: string) {
    return mutate('finish_service_journey', { p_request_id: id, p_action: action, p_session_id: session ?? null })
  },
}
