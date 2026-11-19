import { Select } from '@/components/ui/Select'
import { VECTOR_STYLES, type VectorStyle } from '../vectorStyles'

export function VectorStyleControl({ value, onChange }: { value: VectorStyle; onChange: (style: VectorStyle) => void }) {
  return (
    <Select aria-label="Estilo del mapa" className="h-9 text-label" value={value}
      onChange={(event) => onChange(event.target.value as VectorStyle)}>
      {(Object.entries(VECTOR_STYLES)).map(([key, style]) => <option key={key} value={key}>{style.label}</option>)}
    </Select>
  )
}
