import { useCallback, useState } from 'react'
import { Link } from 'react-router'
import { ChevronRight, ClipboardList, RefreshCw } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { buttonStyles } from '@/components/ui/button.styles'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/components/ui/LoadingState'
import { buildServiceRequestPath, ROUTES } from '@/config/routes'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { REQUEST_STATUS, requestMoney, requestSchedule, requestTimestamp } from '@/features/serviceRequests/presentation'
import { useAsyncData } from '@/hooks/useAsyncData'
import { REQUEST_PAGE_SIZE, serviceRequests } from '@/services/serviceRequests.service'
import type { RequestRole, ServiceRequestListItem } from '@/types/serviceRequest'

function RequestCard({ request, role }: { request: ServiceRequestListItem; role: RequestRole }) {
  const other = role === 'client' ? request.worker_name : request.client_name
  const status = REQUEST_STATUS[request.status]
  const amount = request.agreed_amount_bob ?? request.current_offer?.amount_bob
  const amountLabel = request.status === 'accepted' ? 'Importe acordado' : 'Última propuesta'
  return (
    <Card as="li" padding="md" className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="wrap-break-word text-heading text-ink">{request.category_name}</h2>
          <p className="wrap-break-word text-label text-ink-muted">{other}</p>
        </div>
        <Badge tone={status.tone} dot>{status.label}</Badge>
      </div>
      <p className="line-clamp-2 wrap-break-word text-body text-ink-muted">{request.description}</p>
      <dl className="grid gap-2 text-label sm:grid-cols-2">
        <div><dt className="text-ink-subtle">Fecha solicitada</dt><dd>{requestSchedule(request.requested_date, request.requested_time)}</dd></div>
        <div><dt className="text-ink-subtle">Enviada</dt><dd>{requestTimestamp(request.created_at)}</dd></div>
        <div>
          <dt className="text-ink-subtle">{amount === undefined ? 'Presupuesto' : amountLabel}</dt>
          <dd className="font-semibold text-ink">{amount === undefined ? 'Solicita cotización' : requestMoney(amount)}</dd>
        </div>
      </dl>
      <Link to={buildServiceRequestPath(request.id)} className={buttonStyles({ variant: 'secondary', size: 'sm', className: 'self-start' })}>
        Ver detalle <ChevronRight className="size-4" aria-hidden />
      </Link>
    </Card>
  )
}

function ActivityRequests({ userId, role }: { userId: string; role: RequestRole }) {
  const [page, setPage] = useState(0)
  const [refreshKey, setRefreshKey] = useState(0)
  const load = useCallback((signal: AbortSignal) => serviceRequests.list(userId, role, page, signal), [userId, role, page])
  const state = useAsyncData(load, { refreshKey })
  const items = state.data ?? []
  const hasNext = items.length > REQUEST_PAGE_SIZE
  const isClient = role === 'client'

  return (
    <div className="container-app flex flex-col gap-6 pt-6 md:pt-8">
      <PageHeader title="Actividad" description={isClient ? 'Solicitudes enviadas' : 'Solicitudes recibidas'} />
      <Button variant="outline" size="sm" leftIcon={RefreshCw} className="self-start"
        disabled={state.status === 'loading'} onClick={() => setRefreshKey((key) => key + 1)}>
        Actualizar
      </Button>
      {state.status === 'loading' && <LoadingState label="Cargando solicitudes..." />}
      {state.status === 'error' && <Alert>{state.error.message}</Alert>}
      {state.status === 'success' && items.length === 0 && (
        <Card padding="none">
          <EmptyState icon={ClipboardList} title={page > 0 ? 'Sin solicitudes en esta página' : 'Aún no tienes solicitudes'}
            description={isClient ? 'Las solicitudes que envíes aparecerán en Actividad.' : 'Las solicitudes de tus clientes aparecerán en Actividad.'}
            action={isClient && page === 0 && (
              <Link to={ROUTES.search} className={buttonStyles({ variant: 'secondary' })}>Explorar servicios</Link>
            )} />
        </Card>
      )}
      {items.length > 0 && (
        <ul className="grid gap-4 md:grid-cols-2">
          {items.slice(0, REQUEST_PAGE_SIZE).map((request) => <RequestCard key={request.id} request={request} role={role} />)}
        </ul>
      )}
      {(page > 0 || hasNext) && (
        <nav aria-label="Paginación de solicitudes" className="flex flex-wrap items-center gap-2.5">
          <Button size="sm" variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</Button>
          <span className="text-label text-ink-muted">Página {page + 1}</span>
          <Button size="sm" variant="secondary" disabled={!hasNext} onClick={() => setPage(page + 1)}>Siguiente</Button>
        </nav>
      )}
    </div>
  )
}

export function ActivityPage() {
  const { user } = useAuth()
  if (!user?.accountType) return null
  return <ActivityRequests key={user.id} userId={user.id} role={user.accountType} />
}
