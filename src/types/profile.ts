import type { WorkerAvailability } from './worker'

/** Mirrors `public.verification_status`. Only the review process can change it. */
export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected'

/** Mirrors `public.pricing_mode` (migration 0004). */
export type PricingMode = 'per_hour' | 'per_job' | 'quote'

/** Category as stored in `public.categories` (ids are not limited to the mock union). */
export interface CatalogCategory {
  id: string
  name: string
  description: string
}

/** Work zone from `public.service_zones`. Workers pick a zone, never an exact address. */
export interface ServiceZone {
  id: string
  name: string
}

/** The signed-in worker's own professional profile (`public.worker_profiles`). */
export interface WorkerProfile {
  id: string
  profession: string | null
  description: string | null
  experienceYears: number | null
  serviceRadiusKm: number
  availability: WorkerAvailability
  verificationStatus: VerificationStatus
  /** Reviewer note (e.g. rejection reason). Set only by the review team (migration 0006). */
  verificationNote: string | null
  serviceZoneId: string | null
  pricingMode: PricingMode | null
  /** Reference ("desde") rate in bolivianos. Only with per_hour / per_job. */
  baseRateBob: number | null
  categoryIds: string[]
}

export interface PersonalInfoInput {
  firstName: string
  lastName: string
  phone: string
}

/** Only the columns the database lets a worker edit. */
export interface WorkerProfileInput {
  profession: string
  description: string
  experienceYears: number
  serviceRadiusKm: number
  availability: WorkerAvailability
  serviceZoneId: string
  pricingMode: PricingMode
  baseRateBob: number | null
}

/** Row of `public.worker_certificates` (file lives in a PRIVATE bucket). */
export interface WorkerCertificate {
  id: string
  title: string
  issuer: string | null
  issuedOn: string | null
  storagePath: string
  reviewStatus: VerificationStatus
  createdAt: string
}

export interface CertificateInput {
  title: string
  issuer: string
  /** ISO date (YYYY-MM-DD) or empty. */
  issuedOn: string
  file: File
}

/** Mirrors `public.identity_document_kind`. */
export type IdentityDocumentKind = 'id_front' | 'id_back' | 'selfie'

export interface IdentityDocument {
  kind: IdentityDocumentKind
  storagePath: string
  createdAt: string
}
