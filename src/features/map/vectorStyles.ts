const BASE = 'https://tiles.openfreemap.org/styles'

export const VECTOR_STYLES = {
  liberty: { label: 'Liberty', url: import.meta.env.VITE_VECTOR_STYLE_LIBERTY_URL || `${BASE}/liberty` },
  positron: { label: 'Positron', url: import.meta.env.VITE_VECTOR_STYLE_POSITRON_URL || `${BASE}/positron` },
  dark: { label: 'Oscuro', url: import.meta.env.VITE_VECTOR_STYLE_DARK_URL || `${BASE}/dark` },
} as const

export type VectorStyle = keyof typeof VECTOR_STYLES
