import anaPhoto from '@/assets/workers/ana.jpg'
import carlosPhoto from '@/assets/workers/carlos.jpg'
import danielaPhoto from '@/assets/workers/daniela.jpg'
import jorgePhoto from '@/assets/workers/jorge.jpg'
import luciaPhoto from '@/assets/workers/lucia.jpg'
import miguelPhoto from '@/assets/workers/miguel.jpg'
import type { Worker } from '@/types/worker'

/** Coordinates are scattered around DEFAULT_LOCATION so distances look realistic. */
export const MOCK_WORKERS: readonly Worker[] = [
  {
    id: 'w-001',
    firstName: 'Carlos',
    lastName: 'Mendoza',
    profession: 'Electricista',
    categoryId: 'electricity',
    avatarUrl: carlosPhoto,
    rating: 4.8,
    reviewsCount: 127,
    availability: 'available',
    startingPrice: { amount: 80, currency: 'BOB' },
    location: { lat: -17.7707, lng: -63.1815 },
  },
  {
    id: 'w-002',
    firstName: 'Lucía',
    lastName: 'Rojas',
    profession: 'Técnica en computadoras',
    categoryId: 'technology',
    avatarUrl: luciaPhoto,
    rating: 4.9,
    reviewsCount: 94,
    availability: 'available',
    startingPrice: { amount: 100, currency: 'BOB' },
    location: { lat: -17.7881, lng: -63.1762 },
  },
  {
    id: 'w-003',
    firstName: 'Jorge',
    lastName: 'Quispe',
    profession: 'Plomero',
    categoryId: 'plumbing',
    avatarUrl: jorgePhoto,
    rating: 4.7,
    reviewsCount: 211,
    availability: 'busy',
    startingPrice: { amount: 70, currency: 'BOB' },
    location: { lat: -17.7965, lng: -63.1948 },
  },
  {
    id: 'w-004',
    firstName: 'Ana',
    lastName: 'Gutiérrez',
    profession: 'Limpieza profesional',
    categoryId: 'cleaning',
    avatarUrl: anaPhoto,
    rating: 4.9,
    reviewsCount: 158,
    availability: 'available',
    startingPrice: { amount: 120, currency: 'BOB' },
    location: { lat: -17.7790, lng: -63.1702 },
  },
  {
    id: 'w-005',
    firstName: 'Miguel',
    lastName: 'Vargas',
    profession: 'Carpintero',
    categoryId: 'carpentry',
    avatarUrl: miguelPhoto,
    rating: 4.6,
    reviewsCount: 73,
    availability: 'offline',
    startingPrice: { amount: 150, currency: 'BOB' },
    location: { lat: -17.7610, lng: -63.2010 },
  },
  {
    id: 'w-006',
    firstName: 'Daniela',
    lastName: 'Flores',
    profession: 'Pintora de interiores',
    categoryId: 'painting',
    avatarUrl: danielaPhoto,
    rating: 4.8,
    reviewsCount: 66,
    availability: 'available',
    startingPrice: { amount: 90, currency: 'BOB' },
    location: { lat: -17.7920, lng: -63.1690 },
  },
]
