import { useCallback, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { ClipboardList, RefreshCw } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Section } from '@/components/layout/Section'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { buttonStyles } from '@/components/ui/button.styles'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { LoadingState } from '@/components/ui/LoadingState'
import { Textarea } from '@/components/ui/Textarea'
import { buildServiceJourneyPath, ROUTES } from '@/config/routes'
import { useAuth } from '@/features/auth/hooks/useAuth'
import {
  parseRequestPrice, REQUEST_STATUS, requestMoney, requestSchedule, requestTimestamp,
} from '@/features/serviceRequests/presentation'
import { useAsyncData } from '@/hooks/useAsyncData'
import { serviceRequests } from '@/services/serviceRequests.service'
import type { RequestAction, ServiceOffer, ServiceRequestDetail } from '@/types/serviceRequest'

const CONFIRM_LABEL: Record<RequestAction, string> = {
  offer: 'Enviar oferta',
  accept: 'Confirmar acuerdo',
  reject: 'Confirmar rechazo',
  cancel: 'Confirmar cancelación',
}

function RequestActions({ request, offer, userId, onSaved }: {
  request: ServiceRequestDetail
  offer: ServiceOffer | undefined
  userId: string
  onSaved: (action: RequestAction) => void
}) {
  const [action, setAction] = useState<RequestAction | null>(null)
  const [price, setPrice] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)
  const isWorker = userId === request.worker_id
  const canAccept = Boolean(offer && offer.offered_by !== userId)
  const canReject = isWorker || canAccept

  async function respond(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!action || inFlight.current) return
    const amount = action === 'offer' ? parseRequestPrice(price) : null
    if (action === 'offer' && amount === null) {
      setError('Ingresa un importe positivo en Bs con hasta dos decimales.')
      return
    }
    inFlight.current = true
    setSaving(true)
    setError(null)
    try {
      await serviceRequests.respond(request, action, amount, note.trim())
      onSaved(action)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar tu respuesta.')
    } finally {
      inFlight.current = false
      setSaving(false)
    }
  }

  if (!action) {
    return (
      <div className="flex flex-wrap gap-2">
        {canAccept && <Button onClick={() => setAction('accept')}>{isWorker ? 'Aceptar solicitud' : 'Aceptar oferta'}</Button>}
        {isWorker && (
          <Button variant="secondary" onClick={() => setAction('offer')}>
            {request.status === 'negotiating' ? 'Actualizar oferta' : offer ? 'Enviar contrapropuesta' : 'Enviar cotización'}
          </Button>
        )}
        {canReject && (
          <Button variant="outline" onClick={() => setAction('reject')}>{isWorker ? 'Rechazar solicitud' : 'Rechazar oferta'}</Button>
        )}
        {!isWorker && <Button variant="ghost" onClick={() => setAction('cancel')}>Cancelar solicitud</Button>}
      </div>
    )
  }

  return (
    <form onSubmit={respond} className="flex max-w-lg flex-col gap-4" noValidate>
      {error && <Alert>{error}</Alert>}
      {action === 'offer' && (
        <>
          {request.status === 'negotiating' && <Alert tone="info">Esta oferta reemplazará la anterior.</Alert>}
          <FormField id="service-offer-price" label="Importe de la oferta en Bs" required>
            {(control) => <Input {...control} inputMode="decimal" maxLength={13} value={price}
              disabled={saving} onChange={(event) => setPrice(event.target.value)} />}
          </FormField>
        </>
      )}
      {(action === 'offer' || action === 'reject') && (
        <FormField id="service-response-note" label={action === 'offer' ? 'Observación' : 'Motivo del rechazo'} hint="Opcional">
          {(control) => <Textarea {...control} rows={3} maxLength={300} disabled={saving} value={note}
            onChange={(event) => setNote(event.target.value)} />}
        </FormField>
      )}
      {action === 'accept' && offer && (
        <Alert tone="info">
          Al confirmar, el importe acordado será {requestMoney(offer.amount_bob)} y el profesional tendrá acceso a la dirección del servicio.
        </Alert>
      )}
      {action === 'reject' && <Alert tone="info">Al confirmar el rechazo se cerrará esta solicitud.</Alert>}
      {action === 'cancel' && <Alert tone="info">Al cancelar se cerrará la solicitud y ya no podrá negociarse.</Alert>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant={action === 'reject' || action === 'cancel' ? 'danger' : 'primary'}
          isLoading={saving} loadingText="Guardando...">{CONFIRM_LABEL[action]}</Button>
        <Button variant="ghost" disabled={saving} onClick={() => {
          setAction(null)
          setError(null)
          setPrice('')
          setNote('')
        }}>Volver</Button>
      </div>
    </form>
  )
}

const SAVED_MESSAGE: Record<RequestAction, string> = {
  offer: 'Oferta enviada.',
  accept: 'Contratación confirmada.',
  reject: 'Rechazo registrado.',
  cancel: 'Solicitud cancelada.',
}

function RequestContent({ request, userId, onSaved }: {
  request: ServiceRequestDetail
  userId: string
  onSaved: (action: RequestAction) => void
}) {
  const status = REQUEST_STATUS[request.status]
  const offer = request.offers.find((item) => item.id === request.current_offer_id)
  const open = request.status === 'pending' || request.status === 'negotiating'
  const isWorker = userId === request.worker_id

  return (
    <>
      <Card padding="lg" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="wrap-break-word text-heading text-ink">{request.category_name}</h2>
            <p className="wrap-break-word text-label text-ink-muted">
              {isWorker ? `Solicitada por ${request.client_name}` : `Profesional: ${request.worker_name}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone={status.tone} dot>{status.label}</Badge>
            {request.journey_status === 'cancelled' && <Badge tone="accent">Servicio cancelado</Badge>}
            {request.journey_status === 'arrived' && <Badge tone="success">Profesional en destino</Badge>}
          </div>
        </div>
        <p className="wrap-break-word text-body whitespace-pre-wrap text-ink-muted">{request.description}</p>
        <dl className="grid gap-3 text-label sm:grid-cols-2">
          <div><dt className="text-ink-subtle">Horario solicitado (Bolivia)</dt><dd>{requestSchedule(request.requested_date, request.requested_time)}</dd></div>
          <div><dt className="text-ink-subtle">Enviada</dt><dd>{requestTimestamp(request.created_at)}</dd></div>
        </dl>
        {request.decision_note && (
          <div>
            <h3 className="text-label text-ink">Motivo del rechazo</h3>
            <p className="wrap-break-word text-label whitespace-pre-wrap text-ink-muted">{request.decision_note}</p>
          </div>
        )}
      </Card>
      <Card padding="lg">
        <Section id="service-request-location" title="Ubicación del servicio">
          {request.location ? (
            <div className="wrap-break-word text-body text-ink-muted">
              <p>{request.location.address}</p>
              {request.location.reference && <p className="mt-1 text-label">{request.location.reference}</p>}
            </div>
          ) : (
            <p className="text-label text-ink-muted">
              {open ? 'La dirección se comparte con el profesional al confirmar el acuerdo.' : 'No hay una dirección compartida para esta solicitud.'}
            </p>
          )}
          {request.status === 'accepted' && (
            <Link to={buildServiceJourneyPath(request.id)} className={buttonStyles({ variant: 'secondary', className: 'self-start' })}>
              Ver seguimiento y destino
            </Link>
          )}
        </Section>
      </Card>
      <Card padding="lg">
        <Section id="service-request-offers" title={request.status === 'accepted' ? 'Acuerdo confirmado' : 'Presupuesto y ofertas'}>
          {request.agreed_amount_bob !== null && (
            <div>
              <p className="text-title text-ink">{requestMoney(request.agreed_amount_bob)}</p>
              {request.agreed_at && <p className="text-caption text-ink-muted">Confirmado el {requestTimestamp(request.agreed_at)}</p>}
            </div>
          )}
          {!request.offers.length && <p className="text-label text-ink-muted">Solicita cotización.</p>}
          {request.offers.length > 0 && (
            <ul className="divide-y divide-border/70" aria-label="Historial de ofertas">
              {request.offers.map((item) => (
                <li key={item.id} className="flex flex-col gap-1 py-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-label font-semibold text-ink">
                      {item.offered_by === request.client_id ? 'Propuesta del cliente' : 'Oferta del profesional'} · {requestMoney(item.amount_bob)}
                    </p>
                    {open && item.id === offer?.id && <Badge tone="primary">Vigente</Badge>}
                  </div>
                  <p className="text-caption text-ink-muted">{requestTimestamp(item.created_at)}</p>
                  {item.note && <p className="wrap-break-word text-label whitespace-pre-wrap text-ink-muted">{item.note}</p>}
                </li>
              ))}
            </ul>
          )}
          {open && <RequestActions key={request.revision} request={request} offer={offer} userId={userId} onSaved={onSaved} />}
        </Section>
      </Card>
    </>
  )
}

function RequestDetail({ id, userId, justCreated }: { id: string; userId: string; justCreated: boolean }) {
  const [refreshKey, setRefreshKey] = useState(0)
  const [feedback, setFeedback] = useState(justCreated ? 'Solicitud registrada.' : '')
  const load = useCallback((signal: AbortSignal) => serviceRequests.get(id, signal), [id])
  const state = useAsyncData(load, { refreshKey })
  return (
    <div className="container-app pt-6 md:pt-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <PageHeader title="Detalle de la solicitud" backTo={ROUTES.activity} />
        <Button variant="outline" size="sm" leftIcon={RefreshCw} className="self-start"
          disabled={state.status === 'loading'} onClick={() => { setFeedback(''); setRefreshKey((key) => key + 1) }}>
          Actualizar
        </Button>
        {feedback && <Alert tone="success">{feedback}</Alert>}
        {state.status === 'loading' && <LoadingState label="Cargando solicitud..." />}
        {state.status === 'error' && <Alert>{state.error.message}</Alert>}
        {state.status === 'success' && !state.data && (
          <Card padding="none"><EmptyState icon={ClipboardList} title="Solicitud no disponible"
            description="Solo las partes de la solicitud pueden abrir este detalle." /></Card>
        )}
        {state.data && <RequestContent request={state.data} userId={userId} onSaved={(action) => {
          setFeedback(SAVED_MESSAGE[action])
          setRefreshKey((key) => key + 1)
        }} />}
      </div>
    </div>
  )
}

export function ServiceRequestPage() {
  const { requestId = '' } = useParams()
  const { state } = useLocation()
  const { user } = useAuth()
  if (!user) return null
  return <RequestDetail key={`${user.id}:${requestId}`} userId={user.id} id={requestId}
    justCreated={(state as { created?: boolean } | null)?.created === true} />
}
