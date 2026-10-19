import type { Money } from '@/types/worker'

const CURRENCY_SYMBOL: Record<Money['currency'], string> = {
  BOB: 'Bs',
}

export function formatMoney({ amount, currency }: Money): string {
  const value = new Intl.NumberFormat('es-BO', { maximumFractionDigits: 0 }).format(amount)
  return `${CURRENCY_SYMBOL[currency]} ${value}`
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`
  return `${km.toFixed(1)} km`
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
