import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Award, Building2, CalendarDays, Eye, FileText, Paperclip, Plus, Trash2 } from 'lucide-react'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/LoadingState'
import { Select } from '@/components/ui/Select'
import { MAX_CERTIFICATES, verificationService } from '@/services/verification.service'
import type { ProfessionalDocumentKind, WorkerCertificate } from '@/types/profile'
import { DOCUMENT_MIME_TYPES, validateUploadFile } from '@/utils/files'
import { useCertificates } from '../hooks/useVerificationData'
import { openPrivateFile } from '../openPrivateFile'
import { DOCUMENT_LABELS, DOCUMENT_REVIEW_STATUS, documentKindLabel } from '../professionalDocuments'

const DOCUMENT_KINDS = Object.keys(DOCUMENT_LABELS) as ProfessionalDocumentKind[]

interface CertificateErrors {
  documentKind?: string
  title?: string
  issuer?: string
  issuedOn?: string
  file?: string
}

function todayIso(): string {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

function formatDate(iso: string): string {
  const [year = 1970, month = 1, day = 1] = iso.slice(0, 10).split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('es-BO', { day: 'numeric', month: 'short', year: 'numeric' })
}

function validateCertificate(title: string, issuer: string, issuedOn: string, file: File | null): CertificateErrors {
  const errors: CertificateErrors = {}
  const cleanTitle = title.trim()
  if (cleanTitle.length < 3 || cleanTitle.length > 120) errors.title = 'El nombre debe tener entre 3 y 120 caracteres.'
  if (issuer.trim().length > 120) errors.issuer = 'El nombre de quien emite el documento no puede superar los 120 caracteres.'
  if (issuedOn && issuedOn > todayIso()) errors.issuedOn = 'La fecha de emisión no puede ser futura.'
  if (!file) errors.file = 'Adjunta el documento en PDF o imagen.'
  else {
    const invalid = validateUploadFile(file, DOCUMENT_MIME_TYPES)
    if (invalid) errors.file = invalid
  }
  return errors
}

function CertificateForm({ userId, onAdded }: { userId: string; onAdded: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [documentKind, setDocumentKind] = useState<ProfessionalDocumentKind | ''>('')
  const [title, setTitle] = useState('')
  const [issuer, setIssuer] = useState('')
  const [issuedOn, setIssuedOn] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [errors, setErrors] = useState<CertificateErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null
    setFile(selected)
    setErrors((current) => ({
      ...current,
      file: selected ? validateUploadFile(selected, DOCUMENT_MIME_TYPES) : undefined,
    }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitError(null)
    const nextErrors = validateCertificate(title, issuer, issuedOn, file)
    if (!documentKind) nextErrors.documentKind = 'Selecciona el tipo de documento.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0 || !file || !documentKind) return

    setIsSubmitting(true)
    try {
      await verificationService.addCertificate(userId, { documentKind, title, issuer, issuedOn, file })
      setDocumentKind('')
      setTitle('')
      setIssuer('')
      setIssuedOn('')
      setFile(null)
      if (fileRef.current) fileRef.current.value = ''
      onAdded()
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'No se pudo registrar el documento.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="flex flex-col gap-4 rounded-lg border border-border/70 bg-surface-muted/40 p-4"
      aria-label="Agregar certificado o recomendación"
    >
      {submitError && <Alert>{submitError}</Alert>}

      <FormField id="certificate-kind" label="Tipo de documento" required error={errors.documentKind}>
        {({ invalid, ...control }) => (
          <Select
            {...control}
            invalid={invalid}
            value={documentKind}
            onChange={(event) => setDocumentKind(
              DOCUMENT_KINDS.find((kind) => kind === event.target.value) ?? '',
            )}
          >
            <option value="">Selecciona un tipo</option>
            {DOCUMENT_KINDS.map((kind) => <option key={kind} value={kind}>{DOCUMENT_LABELS[kind]}</option>)}
          </Select>
        )}
      </FormField>

      <FormField id="certificate-title" label="Nombre o descripción del documento" required error={errors.title}>
        {({ invalid, ...control }) => (
          <Input
            {...control}
            invalid={invalid}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={120}
            leftIcon={Award}
          />
        )}
      </FormField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField id="certificate-issuer" label="Empresa, institución o persona emisora" error={errors.issuer} hint="Opcional">
          {({ invalid, ...control }) => (
            <Input
              {...control}
              invalid={invalid}
              value={issuer}
              onChange={(event) => setIssuer(event.target.value)}
              maxLength={120}
              leftIcon={Building2}
            />
          )}
        </FormField>
        <FormField id="certificate-date" label="Fecha de emisión" error={errors.issuedOn} hint="Opcional">
          {({ invalid, ...control }) => (
            <Input
              {...control}
              invalid={invalid}
              type="date"
              value={issuedOn}
              max={todayIso()}
              onChange={(event) => setIssuedOn(event.target.value)}
              leftIcon={CalendarDays}
            />
          )}
        </FormField>
      </div>

      <FormField
        id="certificate-file"
        label="Archivo"
        required
        error={errors.file}
        hint="PDF, JPG, PNG o WEBP de hasta 5 MB. Solo tú y el equipo de revisión pueden verlo."
      >
        {({ invalid, id, ...control }) => (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              ref={fileRef}
              id={id}
              type="file"
              accept={DOCUMENT_MIME_TYPES.join(',')}
              onChange={handleFile}
              aria-invalid={invalid || undefined}
              aria-describedby={control['aria-describedby']}
              className="sr-only"
            />
            <Button variant="outline" leftIcon={Paperclip} onClick={() => fileRef.current?.click()}>
              {file ? 'Cambiar archivo' : 'Seleccionar archivo'}
            </Button>
            <span className="truncate text-caption text-ink-muted">{file ? file.name : 'Ningún archivo seleccionado'}</span>
          </div>
        )}
      </FormField>

      <Button type="submit" leftIcon={Plus} isLoading={isSubmitting} loadingText="Subiendo..." className="self-start">
        Agregar certificado o recomendación
      </Button>
    </form>
  )
}

function CertificateItem({ certificate, onDeleted }: { certificate: WorkerCertificate; onDeleted: () => void }) {
  const [busy, setBusy] = useState<'open' | 'delete' | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const review = DOCUMENT_REVIEW_STATUS[certificate.reviewStatus]
  const isPdf = certificate.storagePath.endsWith('.pdf')

  async function handleOpen() {
    setError(null)
    setBusy('open')
    try {
      await openPrivateFile(() => verificationService.getCertificateUrl(certificate.storagePath))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo abrir el archivo.')
    } finally {
      setBusy(null)
    }
  }

  async function handleDelete() {
    setError(null)
    setBusy('delete')
    try {
      await verificationService.deleteCertificate(certificate)
      onDeleted()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo eliminar el documento.')
      setBusy(null)
      setConfirming(false)
    }
  }

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border/70 bg-white p-4 shadow-xs">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary-50 text-primary-700">
          {isPdf ? <FileText className="size-5" strokeWidth={2} aria-hidden /> : <Award className="size-5" strokeWidth={2} aria-hidden />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-label font-semibold text-ink">{certificate.title}</p>
          <p className="truncate text-caption text-ink-muted">
            {[documentKindLabel(certificate.documentKind), certificate.issuer, certificate.issuedOn ? formatDate(certificate.issuedOn) : null]
              .filter(Boolean).join(' · ')}
          </p>
        </div>
        <Badge tone={review.tone}>{review.label}</Badge>
      </div>

      {error && <Alert>{error}</Alert>}
      {certificate.reviewStatus === 'verified' && (
        <p className="text-caption text-ink-muted">Revisado como respaldo de formación o experiencia.</p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" leftIcon={Eye} onClick={handleOpen} isLoading={busy === 'open'} disabled={busy !== null}>
          Ver archivo
        </Button>
        {confirming ? (
          <>
            <Button variant="danger" size="sm" onClick={handleDelete} isLoading={busy === 'delete'} loadingText="Eliminando...">
              Confirmar eliminación
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={busy !== null}>
              Cancelar
            </Button>
          </>
        ) : (
          <Button variant="ghost" size="sm" leftIcon={Trash2} onClick={() => setConfirming(true)} disabled={busy !== null}>
            Eliminar
          </Button>
        )}
      </div>
    </li>
  )
}

/** Worker certificates stored in the PRIVATE bucket `worker-certificates`. */
export function CertificatesManager({ userId }: { userId: string }) {
  const state = useCertificates(userId)
  const [showForm, setShowForm] = useState(false)
  const certificates = state.data ?? []
  const reachedLimit = certificates.length >= MAX_CERTIFICATES

  return (
    <section aria-labelledby="certificates-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="certificates-title" className="text-heading text-ink">
            Certificados y recomendaciones laborales
          </h2>
          <p className="text-caption text-ink-subtle">
            Puedes respaldar tu formación o experiencia con certificados, constancias laborales o cartas de recomendación. Estos documentos son opcionales y no necesitas un título técnico para ofrecer tus servicios.
          </p>
        </div>
        {state.status === 'success' && (
          <span className="text-caption text-ink-muted">
            {certificates.length} de {MAX_CERTIFICATES}
          </span>
        )}
      </div>

      {state.status === 'loading' && (
        <div className="flex flex-col gap-3" aria-busy="true" aria-label="Cargando documentos profesionales">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      )}

      {state.status === 'error' && (
        <div className="flex flex-col items-start gap-3">
          <Alert>{state.error.message}</Alert>
          <Button variant="secondary" size="sm" onClick={state.reload}>
            Reintentar
          </Button>
        </div>
      )}

      {state.status === 'success' && (
        <>
          {certificates.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border-strong p-4 text-center text-caption text-ink-muted">
              Aún no registraste documentos profesionales.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {certificates.map((certificate) => (
                <CertificateItem key={certificate.id} certificate={certificate} onDeleted={state.reload} />
              ))}
            </ul>
          )}

          {reachedLimit ? (
            <Alert tone="info">Alcanzaste el máximo de {MAX_CERTIFICATES} documentos. Elimina uno para agregar otro.</Alert>
          ) : showForm ? (
            <CertificateForm
              userId={userId}
              onAdded={() => {
                setShowForm(false)
                state.reload()
              }}
            />
          ) : (
            <Button variant="outline" leftIcon={Plus} onClick={() => setShowForm(true)} className="self-start">
              Agregar certificado o recomendación
            </Button>
          )}
        </>
      )}
    </section>
  )
}
