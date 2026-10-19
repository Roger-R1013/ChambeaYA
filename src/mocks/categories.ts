import type { Category } from '@/types/category'

export const MOCK_CATEGORIES: readonly Category[] = [
  { id: 'electricity', name: 'Electricidad', description: 'Instalaciones y reparaciones', workersCount: 48 },
  { id: 'plumbing', name: 'Plomería', description: 'Fugas, cañerías y sanitarios', workersCount: 36 },
  { id: 'technology', name: 'Tecnología', description: 'Computadoras y celulares', workersCount: 52 },
  { id: 'cleaning', name: 'Limpieza', description: 'Hogares y oficinas', workersCount: 64 },
  { id: 'mechanics', name: 'Mecánica', description: 'Diagnóstico y mantenimiento', workersCount: 29 },
  { id: 'construction', name: 'Construcción', description: 'Albañilería y obras', workersCount: 41 },
  { id: 'carpentry', name: 'Carpintería', description: 'Muebles a medida', workersCount: 23 },
  { id: 'painting', name: 'Pintura', description: 'Interiores y exteriores', workersCount: 31 },
]
