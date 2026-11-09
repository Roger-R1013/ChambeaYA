import type { PricingMode } from '@/types/profile'

interface PricingMeta {
  label: string
  description: string
  /** Suffix shown after the amount (e.g. "Bs 80 / hora"). */
  unit: string
}

/** Display copy for `public.pricing_mode`. */
export const PRICING_META: Record<PricingMode, PricingMeta> = {
  per_hour: { label: 'Por hora', description: 'Cobras según el tiempo trabajado.', unit: '/ hora' },
  per_job: { label: 'Por trabajo', description: 'Precio cerrado por cada servicio.', unit: '/ trabajo' },
  quote: { label: 'A cotizar', description: 'Defines el precio tras conocer el trabajo.', unit: '' },
}

export const PRICING_OPTIONS: PricingMode[] = ['per_hour', 'per_job', 'quote']

/** "Desde Bs 80 / hora", "A cotizar" or null when nothing is defined yet. */
export function formatReferencePrice(mode: PricingMode | null, rate: number | null): string | null {
  if (!mode) return null
  if (mode === 'quote' || rate === null) return PRICING_META[mode].label
  const amount = new Intl.NumberFormat('es-BO', { maximumFractionDigits: 2 }).format(rate)
  return `Desde Bs ${amount} ${PRICING_META[mode].unit}`
}
