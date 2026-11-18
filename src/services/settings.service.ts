import { requireSupabase } from '@/lib/supabase'

export interface NotificationPreferences {
  service_requests: boolean
  job_updates: boolean
  identity_reviews: boolean
  document_reviews: boolean
  security_notices: boolean
}

const NOTIFICATION_COLUMNS = 'service_requests, job_updates, identity_reviews, document_reviews, security_notices'

const DEFAULT_PREFERENCES: NotificationPreferences = {
  service_requests: false,
  job_updates: false,
  identity_reviews: false,
  document_reviews: false,
  security_notices: true,
}

function preferencesError(error: { code?: string }, fallback: string): Error {
  if (error.code === '42P01' || error.code === 'PGRST205') {
    return new Error('Las preferencias de notificaciones todavía no están disponibles.')
  }
  if (error.code === 'PGRST301' || error.code === 'PGRST303') {
    return new Error('Tu sesión expiró. Inicia sesión nuevamente.')
  }
  return new Error(fallback)
}

export const settingsService = {
  async getNotifications(userId: string, signal: AbortSignal): Promise<NotificationPreferences> {
    const { data, error } = await requireSupabase()
      .from('notification_preferences')
      .select(NOTIFICATION_COLUMNS)
      .eq('user_id', userId)
      .abortSignal(signal)
      .maybeSingle<NotificationPreferences>()
    if (error) throw preferencesError(error, 'No se pudieron cargar tus preferencias. Inténtalo nuevamente.')
    return data ?? DEFAULT_PREFERENCES
  },

  async saveNotifications(userId: string, changes: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
    const { data, error } = await requireSupabase()
      .from('notification_preferences')
      .upsert({ user_id: userId, ...changes }, { onConflict: 'user_id', defaultToNull: false })
      .select(NOTIFICATION_COLUMNS)
      .single<NotificationPreferences>()
    if (error) throw preferencesError(error, 'No se pudieron guardar tus preferencias. Inténtalo nuevamente.')
    return data
  },
}
