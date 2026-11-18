import { useCallback, useState, type ReactNode } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { LoadingState } from '@/components/ui/LoadingState'
import { ROUTES } from '@/config/routes'
import { ReviewActions, ReviewFileButton } from '@/features/admin/ReviewActions'
import { useAdminAccess } from '@/features/admin/useAdminAccess'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { DOCUMENT_REVIEW_STATUS, documentKindLabel } from '@/features/profile/professionalDocuments'
import { VERIFICATION_META } from '@/features/profile/verification'
import { useAsyncData } from '@/hooks/useAsyncData'
import {
  ADMIN_PAGE_SIZE, adminService, type AdminDocument, type AdminIdentityRequest,
} from '@/services/admin.service'
import { IDENTITY_DOCUMENT_KINDS } from '@/services/verification.service'
import type { IdentityDocumentKind } from '@/types/profile'

const METRICS = [
  { key: 'workers', label: 'Trabajadores registrados' },
  { key: 'clients', label: 'Clientes registrados' },
  { key: 'identity_pending', label: 'Verificaciones de identidad pendientes' },
  { key: 'documents_pending', label: 'Documentos pendientes' },
  { key: 'documents_approved', label: 'Documentos aprobados' },
  { key: 'documents_rejected', label: 'Documentos rechazados' },
] as const

const SECTIONS = [
  { id: 'documents', label: 'Documentos profesionales' },
  { id: 'history', label: 'Historial documental' },
  { id: 'identity', label: 'Verificación de identidad' },
  { id: 'workers', label: 'Trabajadores' },
] as const

const IDENTITY_LABELS: Record<IdentityDocumentKind, string> = {
  id_front: 'Anverso del documento',
  id_back: 'Reverso del documento',
  selfie: 'Selfie',
}

const NUMBER_FORMAT = new Intl.NumberFormat('es-BO')
const DATE_FORMAT = new Intl.DateTimeFormat('es-BO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/La_Paz' })

function formatReviewDate(value: string | null) {
  return value ? DATE_FORMAT.format(new Date(value)) : 'Fecha sin registrar'
}

function AdminMetrics({ refreshKey }: { refreshKey: number }) {
  const metrics = useAsyncData(adminService.getMetrics, { refreshKey })
  if (metrics.status === 'loading') return <LoadingState label="Cargando indicadores..." />
  if (metrics.status === 'error') return <Alert>{metrics.error.message}</Alert>
  const { data } = metrics

  return (
    <dl className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" aria-label="Indicadores administrativos">
      {METRICS.map(({ key, label }) => (
        <Card key={key} as="div" padding="md" className="flex flex-col gap-1">
          <dt className="text-caption text-ink-muted">{label}</dt>
          <dd className="text-title text-ink">{NUMBER_FORMAT.format(data[key])}</dd>
        </Card>
      ))}
    </dl>
  )
}

function AdminList<T>({ load, refreshKey, empty, children }: {
  load: (offset: number, signal: AbortSignal) => Promise<T[]>
  refreshKey: number
  empty: string
  children: (items: T[]) => ReactNode
}) {
  const [page, setPage] = useState(0)
  const loader = useCallback((signal: AbortSignal) => load(page * ADMIN_PAGE_SIZE, signal), [load, page])
  const state = useAsyncData(loader, { refreshKey })
  const rows = state.data ?? []
  const hasNext = rows.length > ADMIN_PAGE_SIZE

  return (
    <div className="flex flex-col gap-4">
      {state.status === 'loading' && <LoadingState label="Cargando registros..." />}
      {state.status === 'error' && <Alert>{state.error.message}</Alert>}
      {state.status === 'success' && (
        rows.length ? children(rows.slice(0, ADMIN_PAGE_SIZE)) : <p className="text-body text-ink-muted">{empty}</p>
      )}
      {(page > 0 || hasNext) && (
        <div className="flex flex-wrap items-center gap-2.5" aria-label="Paginación">
          <Button size="sm" variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</Button>
          <span className="text-label text-ink-muted">Página {page + 1}</span>
          <Button size="sm" variant="secondary" disabled={!hasNext} onClick={() => setPage(page + 1)}>Siguiente</Button>
        </div>
      )}
    </div>
  )
}

function DocumentItem({ item, history, userId, onReviewed }: {
  item: AdminDocument
  history: boolean
  userId: string
  onReviewed: () => void
}) {
  const status = DOCUMENT_REVIEW_STATUS[item.review_status]
  return (
    <Card as="article" padding="md" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="wrap-break-word text-heading text-ink">{item.title}</h3>
          <p className="text-label text-ink-muted">{item.worker_name ?? item.worker_id} · {documentKindLabel(item.document_kind)}</p>
          {(item.issuer || item.issued_on) && (
            <p className="wrap-break-word text-caption text-ink-muted">{[item.issuer, item.issued_on].filter(Boolean).join(' · ')}</p>
          )}
          {item.created_at && <p className="text-caption text-ink-muted">Presentado el {formatReviewDate(item.created_at)}</p>}
        </div>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>

      {history && (
        <div className="flex flex-col gap-1 text-label text-ink-muted">
          <p>{item.reviewed_at
            ? `Revisión del ${formatReviewDate(item.reviewed_at)} por ${item.reviewer_name ?? item.reviewer_id ?? 'revisor sin registrar'}`
            : 'Decisión anterior sin fecha ni revisor registrados.'}</p>
          {item.note && <p className="wrap-break-word whitespace-pre-wrap">{item.note}</p>}
        </div>
      )}

      {item.file_available ? (
        <ReviewFileButton label="Ver archivo privado" getUrl={() => adminService.getFileUrl({ documentId: item.id })} />
      ) : (
        <p className="text-caption text-ink-muted">El archivo ya no está disponible.</p>
      )}
      {!history && (
        item.worker_id === userId
          ? <p className="text-caption text-ink-muted">Otro administrador debe revisar este documento.</p>
          : <ReviewActions canApprove={item.file_available} onReviewed={onReviewed}
              onReview={(approve, note) => adminService.reviewDocument(item.id, approve, note)} />
      )}
    </Card>
  )
}

function Documents({ history, refreshKey, userId, onReviewed }: {
  history: boolean
  refreshKey: number
  userId: string
  onReviewed: () => void
}) {
  const load = useCallback((offset: number, signal: AbortSignal) => adminService.listDocuments(history, offset, signal), [history])
  return (
    <AdminList load={load} refreshKey={refreshKey}
      empty={history ? 'Aún no hay revisiones documentales.' : 'No hay documentos profesionales pendientes.'}>
      {(items) => (
        <ul className="grid gap-4 lg:grid-cols-2">
          {items.map((item) => <li key={item.id}>
            <DocumentItem item={item} history={history} userId={userId} onReviewed={onReviewed} />
          </li>)}
        </ul>
      )}
    </AdminList>
  )
}

function IdentityItem({ item, userId, onReviewed }: { item: AdminIdentityRequest; userId: string; onReviewed: () => void }) {
  return (
    <Card as="article" padding="md" className="flex flex-col gap-3">
      <div>
        <h3 className="wrap-break-word text-heading text-ink">{item.worker_name}</h3>
        <p className="text-caption text-ink-muted">{item.submitted_at ? `Solicitud del ${formatReviewDate(item.submitted_at)}` : 'Fecha de solicitud sin registrar'}</p>
      </div>
      <ul className="flex flex-wrap items-start gap-3">
        {IDENTITY_DOCUMENT_KINDS.map((kind) => (
          <li key={kind}>
            {item.available_files.includes(kind) ? (
              <ReviewFileButton label={IDENTITY_LABELS[kind]}
                getUrl={() => adminService.getFileUrl({ workerId: item.worker_id, requestId: item.request_id, kind })} />
            ) : (
              <p className="text-caption text-ink-muted">{IDENTITY_LABELS[kind]} no disponible</p>
            )}
          </li>
        ))}
      </ul>
      {item.worker_id === userId ? (
        <p className="text-caption text-ink-muted">Otro administrador debe revisar esta solicitud.</p>
      ) : (
        <ReviewActions canApprove={item.available_files.length === IDENTITY_DOCUMENT_KINDS.length} requireApprovalNote
          onReviewed={onReviewed}
          onReview={(approve, note) => adminService.reviewIdentity(item.worker_id, item.request_id, approve, note)} />
      )}
    </Card>
  )
}

function IdentityQueue({ refreshKey, userId, onReviewed }: { refreshKey: number; userId: string; onReviewed: () => void }) {
  return (
    <>
      <p className="text-label text-ink-muted">
        Revisa manualmente el anverso, el reverso y la selfie de cada solicitud antes de resolverla.
      </p>
      <AdminList load={adminService.listIdentityRequests} refreshKey={refreshKey} empty="No hay solicitudes de identidad pendientes.">
        {(items) => <ul className="grid gap-4 lg:grid-cols-2">
          {items.map((item) => <li key={item.request_id}><IdentityItem item={item} userId={userId} onReviewed={onReviewed} /></li>)}
        </ul>}
      </AdminList>
    </>
  )
}

function Workers({ refreshKey }: { refreshKey: number }) {
  return (
    <AdminList load={adminService.listWorkers} refreshKey={refreshKey} empty="Aún no hay trabajadores registrados.">
      {(items) => (
        <Card padding="none" className="overflow-x-auto">
          <table className="w-full min-w-[38rem] text-left text-label">
            <caption className="sr-only">Trabajadores registrados y estado de revisión</caption>
            <thead className="bg-surface-muted text-ink">
              <tr>
                <th scope="col" className="px-4 py-3">Trabajador</th>
                <th scope="col" className="px-4 py-3">Especialidades</th>
                <th scope="col" className="px-4 py-3">Identidad</th>
                <th scope="col" className="px-4 py-3">Documentos profesionales</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {items.map((worker) => {
                const status = VERIFICATION_META[worker.verification_status]
                const hasDocuments = worker.documents_pending + worker.documents_approved + worker.documents_rejected > 0
                return (
                  <tr key={worker.id}>
                    <th scope="row" className="px-4 py-3 font-medium text-ink">
                      {worker.name}
                      <span className="block text-caption font-normal text-ink-muted">
                        {worker.profession ?? 'Oficio sin registrar'}
                        {worker.experience_years !== null && ` · Experiencia: ${worker.experience_years} años`}
                      </span>
                    </th>
                    <td className="px-4 py-3 text-ink-muted">{worker.specialties.join(', ') || 'Sin especialidades registradas'}</td>
                    <td className="px-4 py-3"><Badge tone={status.tone}>{status.label}</Badge></td>
                    <td className="px-4 py-3 text-ink-muted">
                      {hasDocuments
                        ? `${worker.documents_pending} pendientes · ${worker.documents_approved} aprobados · ${worker.documents_rejected} rechazados`
                        : 'Sin documentos registrados'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}
    </AdminList>
  )
}

function AdminDashboard({ userId }: { userId: string }) {
  const [section, setSection] = useState<(typeof SECTIONS)[number]['id']>('documents')
  const [refreshKey, setRefreshKey] = useState(0)
  const [reviewSaved, setReviewSaved] = useState(false)
  function refresh() {
    setReviewSaved(false)
    setRefreshKey((current) => current + 1)
  }
  function onReviewed() {
    setReviewSaved(true)
    setRefreshKey((current) => current + 1)
  }

  return (
    <>
      <AdminMetrics refreshKey={refreshKey} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="flex flex-wrap gap-2" aria-label="Secciones de administración">
          {SECTIONS.map(({ id, label }) => (
            <Button key={id} size="sm" variant={section === id ? 'primary' : 'secondary'}
              aria-pressed={section === id} onClick={() => { setSection(id); setReviewSaved(false) }}>
              {label}
            </Button>
          ))}
        </nav>
        <Button size="sm" variant="outline" onClick={refresh}>Actualizar</Button>
      </div>
      {reviewSaved && <Alert tone="success">Decisión registrada.</Alert>}
      <section key={section} className="flex flex-col gap-4" aria-labelledby="admin-section-title">
        <h2 id="admin-section-title" className="text-heading text-ink">{SECTIONS.find(({ id }) => id === section)?.label}</h2>
        {section === 'documents' && (
          <p className="text-label text-ink-muted">La aprobación respalda la información presentada. La acreditación profesional oficial corresponde a la entidad competente.</p>
        )}
        {(section === 'documents' || section === 'history') && (
          <Documents history={section === 'history'} refreshKey={refreshKey} userId={userId} onReviewed={onReviewed} />
        )}
        {section === 'identity' && <IdentityQueue refreshKey={refreshKey} userId={userId} onReviewed={onReviewed} />}
        {section === 'workers' && <Workers refreshKey={refreshKey} />}
      </section>
    </>
  )
}

function ProtectedAdmin({ userId }: { userId: string }) {
  const permission = useAdminAccess(userId)
  if (permission.status === 'loading') return <LoadingState label="Comprobando permisos..." />
  if (permission.status === 'error') return <Alert>{permission.error.message}</Alert>
  if (!permission.data) return <Alert>Esta cuenta no tiene acceso al panel de administración.</Alert>
  return <AdminDashboard userId={userId} />
}

export function AdminPage() {
  const { user } = useAuth()
  if (!user) return null
  return (
    <div className="container-app flex flex-col gap-6 pt-6 md:pt-8">
      <PageHeader title="Administración" backTo={ROUTES.home} />
      <ProtectedAdmin key={user.id} userId={user.id} />
    </div>
  )
}
