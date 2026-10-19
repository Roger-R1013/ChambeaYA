import { HandCoins, MapPin, ShieldCheck, type LucideIcon } from 'lucide-react'

export interface ValueProposition {
  icon: LucideIcon
  title: string
  description: string
}

export const VALUE_PROPOSITIONS: readonly ValueProposition[] = [
  {
    icon: MapPin,
    title: 'Cerca de ti',
    description: 'Profesionales disponibles en tu zona, listos para ir a tu domicilio.',
  },
  {
    icon: ShieldCheck,
    title: 'Perfiles con reseñas',
    description: 'Revisa experiencia y calificaciones antes de decidir.',
  },
  {
    icon: HandCoins,
    title: 'Tú propones el precio',
    description: 'Recibe ofertas y acuerda una tarifa justa para ambos.',
  },
]
