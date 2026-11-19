import type { BadgeTone } from '@/components/ui/Badge'
import type { ServiceRequestStatus } from '@/types/serviceRequest'
import { formatMoney } from '@/utils/format'

export const REQUEST_STATUS = {
  pending: { label: 'Pendiente', tone: 'warning' },
  negotiating: { label: 'En negociación', tone: 'primary' },
  accepted: { label: 'Aceptada', tone: 'success' },
  rejected: { label: 'Rechazada', tone: 'accent' },
  cancelled: { label: 'Cancelada', tone: 'neutral' },
} satisfies Record<ServiceRequestStatus, { label: string; tone: BadgeTone }>

const BOLIVIA = 'America/La_Paz'
const DAY = new Intl.DateTimeFormat('es-BO', { dateStyle: 'medium', timeZone: BOLIVIA })
const TIMESTAMP = new Intl.DateTimeFormat('es-BO', { dateStyle: 'medium', timeStyle: 'short', timeZone: BOLIVIA })
const LOCAL_CLOCK = new Intl.DateTimeFormat('sv-SE', {
  timeZone: BOLIVIA, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})

export function localScheduleNow() {
  return LOCAL_CLOCK.format(new Date()).replace(' ', 'T')
}

export function requestSchedule(day: string, time: string) {
  return `${DAY.format(new Date(`${day}T12:00:00Z`))} · ${time.slice(0, 5)}`
}

export function requestTimestamp(timestamp: string) {
  return TIMESTAMP.format(new Date(timestamp))
}

export function requestMoney(amount: number) {
  return formatMoney({ amount, currency: 'BOB' })
}

/** Accepts a decimal comma or point, with no thousands separators. */
export function parseRequestPrice(value: string): number | null {
  const text = value.trim()
  if (!/^\d{1,10}(?:[.,]\d{1,2})?$/.test(text)) return null
  const amount = Number(text.replace(',', '.'))
  return amount > 0 ? amount : null
}
