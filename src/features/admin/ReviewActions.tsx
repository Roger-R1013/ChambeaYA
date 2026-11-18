import { useId, useState, type FormEvent } from 'react'
import { Eye } from 'lucide-react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import { Textarea } from '@/components/ui/Textarea'
import { openPrivateFile } from '@/features/profile/openPrivateFile'

export function ReviewFileButton({ label, getUrl }: { label: string; getUrl: () => Promise<string> }) {
  const [opening, setOpening] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function open() {
    setOpening(true)
    setError(null)
    try {
      await openPrivateFile(getUrl)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo abrir el archivo.')
    } finally {
      setOpening(false)
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button variant="secondary" size="sm" leftIcon={Eye} onClick={open} isLoading={opening}>
        {label}
      </Button>
      {error && <Alert>{error}</Alert>}
    </div>
  )
}

export function ReviewActions({
  canApprove,
  requireApprovalNote = false,
  onReview,
  onReviewed,
}: {
  canApprove: boolean
  requireApprovalNote?: boolean
  onReview: (approve: boolean, note: string) => Promise<void>
  onReviewed: () => void
}) {
  const noteId = useId()
  const [decision, setDecision] = useState<'approve' | 'reject' | null>(null)
  const [note, setNote] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const noteRequired = decision === 'reject' || requireApprovalNote

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const reason = note.trim()
    if (!decision || pending || (decision === 'approve' && !canApprove)) return
    if (noteRequired && !reason) {
      setError('Ingresa una justificación para registrar la decisión.')
      return
    }
    setPending(true)
    setError(null)
    try {
      await onReview(decision === 'approve', reason)
      onReviewed()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar la revisión.')
    } finally {
      setPending(false)
    }
  }

  if (!decision) {
    return (
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={!canApprove} onClick={() => setDecision('approve')}>Aprobar</Button>
        <Button size="sm" variant="outline" onClick={() => setDecision('reject')}>Rechazar</Button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-md border border-border p-3.5">
      {error && <Alert>{error}</Alert>}
      <FormField id={noteId} label={decision === 'reject' ? 'Motivo del rechazo' : 'Justificación de la aprobación'}
        required={noteRequired} hint={noteRequired ? undefined : 'Opcional'}>
        {({ invalid, ...control }) => (
          <Textarea
            {...control}
            invalid={invalid}
            value={note}
            required={noteRequired}
            maxLength={500}
            rows={3}
            disabled={pending}
            onChange={(event) => setNote(event.target.value)}
          />
        )}
      </FormField>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" variant={decision === 'reject' ? 'danger' : 'primary'} isLoading={pending}>
          {decision === 'reject' ? 'Confirmar rechazo' : 'Confirmar aprobación'}
        </Button>
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => {
          setDecision(null)
          setNote('')
          setError(null)
        }}>Cancelar</Button>
      </div>
    </form>
  )
}
