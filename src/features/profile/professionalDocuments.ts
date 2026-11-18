import type { ProfessionalDocumentKind, VerificationStatus } from '@/types/profile'

export const DOCUMENT_LABELS: Record<ProfessionalDocumentKind, string> = {
  technical_certificate: 'Certificado técnico o profesional',
  training_certificate: 'Certificado de capacitación',
  employment_statement: 'Constancia laboral',
  employer_recommendation: 'Carta de recomendación de un empleador',
  company_employment_certificate: 'Certificado de trabajo emitido por una empresa',
}

export const DOCUMENT_REVIEW_STATUS = {
  unverified: { label: 'Sin revisar', tone: 'neutral' },
  pending: { label: 'En revisión', tone: 'warning' },
  verified: { label: 'Aprobado', tone: 'success' },
  rejected: { label: 'Rechazado', tone: 'accent' },
} as const satisfies Record<VerificationStatus, { label: string; tone: 'neutral' | 'warning' | 'success' | 'accent' }>

export function documentKindLabel(kind: ProfessionalDocumentKind | null): string {
  return kind ? DOCUMENT_LABELS[kind] : 'Tipo sin especificar'
}
