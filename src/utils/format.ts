import type { Money } from '@/types/worker'

const CURRENCY_SYMBOL: Record<Money['currency'], string> = {
  BOB: 'Bs',
}

/** "Bs 80" / "Bs 1.250,50" (Bolivian format). */
export function formatMoney({ amount, currency }: Money): string {
  const value = new Intl.NumberFormat('es-BO', { maximumFractionDigits: 2 }).format(amount)
  return `${CURRENCY_SYMBOL[currency]} ${value}`
}

export function formatDistance(km: number): string {
  const tenths = Math.round(km * 10)
  if (tenths === 0) return 'menos de 100 m'
  if (tenths < 10) return `${tenths * 100} m`
  return `${new Intl.NumberFormat('es-BO', { maximumFractionDigits: 1 }).format(tenths / 10)} km`
}

export function formatRating(rating: number): string {
  return rating.toFixed(1)
}

export function formatReviews(count: number): string {
  return `${count} ${count === 1 ? 'reseña' : 'reseñas'}`
}

export function getFullName(person: { firstName: string; lastName: string }): string {
  return `${person.firstName} ${person.lastName}`.trim()
}

export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}

export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '').replace(/^591/, '')
  if (digits.length !== 8) return phone
  return `+591 ${digits.slice(0, 4)} ${digits.slice(4)}`
}
