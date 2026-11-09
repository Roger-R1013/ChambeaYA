import { useRef, useState, type ChangeEvent } from 'react'
import { Camera, CheckCircle2, Eye, IdCard, Lock, RefreshCw, Send, Upload, UserRound, type LucideIcon } from 'lucide-react'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/LoadingState'
import { IDENTITY_DOCUMENT_KINDS, verificationService } from '@/services/verification.service'
import type { IdentityDocument, IdentityDocumentKind, VerificationStatus } from '@/types/profile'
import { IMAGE_MIME_TYPES, validateUploadFile } from '@/utils/files'
import { useIdentityDocuments } from '../hooks/useVerificationData'
import { openPrivateFile } from '../openPrivateFile'
import { VERIFICATION_META } from '../verification'

const KIND_META: Record<IdentityDocumentKind, { title: string; hint: string; icon: LucideIcon; capture: 'user' | 'environment' }> = {
  id_front: {
    title: 'Anverso del documento',
    hint: 'Carnet de identidad por delante, completo y legible.',
    icon: IdCard,
    capture: 'environment',
  },
  id_back: {
    title: 'Reverso del documento',
    hint: 'Carnet de identidad por detrás, sin reflejos.',
    icon: IdCard,
    capture: 'environment',
  },
  selfie: {
    title: 'Selfie',
    hint: 'Tu rostro de frente, con buena luz y sin lentes oscuros.',
    icon: UserRound,
    capture: 'user',
  },
}

function DocumentSlot({
  userId,
  kind,
  document,
  editable,
  onChanged,
}: {
  userId: string
  kind: IdentityDocumentKind
  document?: IdentityDocument
  editable: boolean
  onChanged: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<'upload' | 'open' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const meta = KIND_META[kind]
  const Icon = meta.icon

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const invalid = validateUploadFile(file, IMAGE_MIME_TYPES)
    if (invalid) {
      setError(invalid)
      return
    }
    setError(null)
    setBusy('upload')
    try {
      await verificationService.uploadIdentityDocument(userId, kind, file, document)
      onChanged()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo subir la imagen.')
    } finally {
      setBusy(null)
    }
  }

  async function handleOpen() {
    if (!document) return
    setError(null)
    setBusy('open')
    try {
      await openPrivateFile(() => verificationService.getIdentityDocumentUrl(document.storagePath))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo abrir la imagen.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border/70 bg-white p-4 shadow-xs">
      <div className="flex items-start gap-3">
        <span
          className={
            document
              ? 'flex size-10 shrink-0 items-center justify-center rounded-md bg-success-50 text-success-700'
              : 'flex size-10 shrink-0 items-center justify-center rounded-md bg-surface-muted text-ink-subtle'
          }
        >
          {document ? <CheckCircle2 className="size-5" strokeWidth={2} aria-hidden /> : <Icon className="size-5" strokeWidth={2} aria-hidden />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-label font-semibold text-ink">{meta.title}</p>
          <p className="text-caption text-ink-muted">{meta.hint}</p>
        </div>
        <Badge tone={document ? 'success' : 'neutral'}>{document ? 'Cargado' : 'Pendiente'}</Badge>
      </div>

      {error && <Alert>{error}</Alert>}

      <div className="flex flex-wrap gap-2">
        <input
          ref={inputRef}
          id={`identity-${kind}`}
          type="file"
          accept={IMAGE_MIME_TYPES.join(',')}
          capture={meta.capture}
          className="sr-only"
          onChange={handleFile}
          disabled={!editable || busy !== null}
          tabIndex={-1}
          aria-hidden
        />
        {editable && (
          <Button
            variant={document ? 'outline' : 'secondary'}
            size="sm"
            leftIcon={document ? RefreshCw : kind === 'selfie' ? Camera : Upload}
            onClick={() => inputRef.current?.click()}
            isLoading={busy === 'upload'}
            loadingText="Subiendo..."
            disabled={busy !== null}
            aria-label={`${document ? 'Reemplazar' : 'Subir'} ${meta.title.toLowerCase()}`}
          >
            {document ? 'Reemplazar' : kind === 'selfie' ? 'Tomar o subir selfie' : 'Subir imagen'}
          </Button>
        )}
        {document && (
          <Button variant="ghost" size="sm" leftIcon={Eye} onClick={handleOpen} isLoading={busy === 'open'} disabled={busy !== null}>
            Ver
          </Button>
        )}
      </div>
    </li>
  )
}

/**
 * Identity verification request. The worker only uploads images and asks for
 * a MANUAL review; no automatic face or document check is performed or claimed.
 * Approval/rejection is done exclusively by the review team (database-enforced).
 */
export function IdentityVerificationPanel({
  userId,
  status,
  note,
  onSubmitted,
}: {
  userId: string
  status: VerificationStatus
  /** Reviewer note (rejection reason), if any. */
  note?: string | null
  onSubmitted: () => void
}) {
  const state = useIdentityDocuments(userId)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const meta = VERIFICATION_META[status]
  const editable = status === 'unverified' || status === 'rejected'
  const byKind = new Map((state.data ?? []).map((doc) => [doc.kind, doc]))
  const uploadedCount = IDENTITY_DOCUMENT_KINDS.filter((kind) => byKind.has(kind)).length
  const complete = uploadedCount === IDENTITY_DOCUMENT_KINDS.length

  async function handleSubmit() {
    setSubmitError(null)
    setIsSubmitting(true)
    try {
      await verificationService.submitIdentityVerification()
      onSubmitted()
    } catch (cause) {
      setSubmitError(cause instanceof Error ? cause.message : 'No se pudo enviar la solicitud.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section aria-labelledby="identity-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="identity-title" className="text-heading text-ink">
            Verificación de identidad
          </h2>
          <p className="text-caption text-ink-subtle">{meta.description}</p>
        </div>
        <Badge tone={meta.tone} icon={meta.icon}>
          {meta.label}
        </Badge>
      </div>

      <div className="flex items-start gap-2.5 rounded-lg bg-primary-50/60 p-3 text-caption text-ink-muted">
        <Lock className="mt-0.5 size-4 shrink-0 text-primary-600" strokeWidth={2} aria-hidden />
        <p>
          Tus documentos se guardan en un almacenamiento privado. No se muestran a los clientes y solo el equipo
          de revisión de ChambeaYA! puede verlos. La revisión es manual. Las imágenes se eliminan 30 días después de
          la revisión.
        </p>
      </div>

      {status === 'rejected' && note && (
        <Alert>
          <span className="font-semibold">Motivo indicado por el equipo de revisión:</span> {note}
        </Alert>
      )}

      {state.status === 'loading' && (
        <div className="flex flex-col gap-3" aria-busy="true" aria-label="Cargando documentos">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
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
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {IDENTITY_DOCUMENT_KINDS.map((kind) => (
              <DocumentSlot
                key={kind}
                userId={userId}
                kind={kind}
                document={byKind.get(kind)}
                editable={editable}
                onChanged={state.reload}
              />
            ))}
          </ul>

          {submitError && <Alert>{submitError}</Alert>}

          {editable ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-caption text-ink-muted">
                {complete
                  ? 'Todo listo. Envía tu solicitud para que el equipo la revise.'
                  : `Cargaste ${uploadedCount} de ${IDENTITY_DOCUMENT_KINDS.length} imágenes requeridas.`}
              </p>
              <Button
                leftIcon={Send}
                onClick={handleSubmit}
                disabled={!complete}
                isLoading={isSubmitting}
                loadingText="Enviando..."
              >
                {status === 'rejected' ? 'Volver a enviar solicitud' : 'Enviar a revisión'}
              </Button>
            </div>
          ) : (
            <Alert tone="info">
              {status === 'pending'
                ? 'Tu solicitud está en revisión. No puedes modificar los documentos mientras tanto.'
                : 'Tu identidad ya fue verificada. Los documentos no se pueden modificar.'}
            </Alert>
          )}
        </>
      )}
    </section>
  )
}
