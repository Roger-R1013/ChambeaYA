import { useCallback, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import { ClipboardList } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { LoadingState } from '@/components/ui/LoadingState'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { buildServiceRequestPath, buildWorkerDetailPath } from '@/config/routes'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useCategories } from '@/features/categories/hooks/useCategories'
import { localScheduleNow, parseRequestPrice } from '@/features/serviceRequests/presentation'
import { useAsyncData } from '@/hooks/useAsyncData'
import { useForm, type FormErrors } from '@/hooks/useForm'
import { serviceRequests } from '@/services/serviceRequests.service'
import { workersService } from '@/services/workers.service'
import type { Category } from '@/types/category'
import type { WorkerDetail } from '@/types/worker'
import { getFullName } from '@/utils/format'

const INITIAL_VALUES = {
  categoryId: '', description: '', date: '', time: '', address: '', reference: '', priced: false, budget: '',
}
type RequestValues = typeof INITIAL_VALUES

function RequestForm({ worker, categories }: { worker: WorkerDetail; categories: Category[] }) {
  const navigate = useNavigate()
  const requestId = useRef<string | null>(null)
  const inFlight = useRef(false)
  const [confirming, setConfirming] = useState(false)
  const form = useForm<RequestValues>({
    initialValues: { ...INITIAL_VALUES, categoryId: categories.length === 1 ? categories[0]?.id ?? '' : '' },
    validate: (values) => {
      const errors: FormErrors<RequestValues> = {}
      if (!categories.some((category) => category.id === values.categoryId)) errors.categoryId = 'Selecciona la especialidad.'
      const size = values.description.trim().length
      if (!size || size > 1500) errors.description = 'Describe el trabajo con hasta 1500 caracteres.'
      if (!values.date) errors.date = 'Elige una fecha.'
      if (!values.time) errors.time = 'Elige una hora aproximada.'
      if (values.date && values.time && `${values.date}T${values.time}` <= localScheduleNow()) {
        errors.time = 'Elige una fecha y hora futuras, en horario de Bolivia.'
      }
      if (!values.address.trim()) errors.address = 'Ingresa la dirección o ubicación del servicio.'
      if (values.priced && parseRequestPrice(values.budget) === null) errors.budget = 'Ingresa un importe positivo con hasta dos decimales.'
      return errors
    },
    onSubmit: async (values) => {
      if (!confirming) {
        setConfirming(true)
        return
      }
      inFlight.current = true
      try {
        requestId.current ??= crypto.randomUUID()
        const id = await serviceRequests.create({
          requestId: requestId.current, workerId: worker.id, categoryId: values.categoryId,
          description: values.description.trim(), date: values.date, time: values.time,
          address: values.address.trim(), reference: values.reference.trim(),
          budget: values.priced ? parseRequestPrice(values.budget) : null,
        })
        navigate(buildServiceRequestPath(id), { replace: true, state: { created: true } })
      } finally {
        inFlight.current = false
      }
    },
  })

  function submit(event: FormEvent<HTMLFormElement>) {
    if (inFlight.current) {
      event.preventDefault()
      return
    }
    void form.handleSubmit(event)
  }

  const locked = confirming || form.isSubmitting
  return (
    <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
      <div>
        <h2 className="text-heading text-ink">{getFullName(worker)}</h2>
        <p className="text-label text-ink-muted">{worker.profession}</p>
      </div>
      {form.submitError && <Alert>{form.submitError}</Alert>}
      <fieldset disabled={locked} className="flex flex-col gap-4">
        <legend className="sr-only">Datos del servicio</legend>
        <FormField id="request-category" label="Especialidad" required error={form.getError('categoryId')}>
          {(control) => (
            <Select {...control} name="categoryId" value={form.values.categoryId}
              onChange={(event) => form.setFieldValue('categoryId', event.target.value)}>
              <option value="">Selecciona una especialidad</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </Select>
          )}
        </FormField>
        <FormField id="request-description" label="Descripción del trabajo" required error={form.getError('description')}
          hint="Describe el trabajo sin incluir tu dirección ni datos de contacto.">
          {(control) => (
            <Textarea {...control} rows={4} name="description" value={form.values.description} maxLength={1500}
              onBlur={form.handleBlur} onChange={(event) => form.setFieldValue('description', event.target.value)} />
          )}
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="request-date" label="Fecha deseada" required error={form.getError('date')}>
            {(control) => <Input {...control} {...form.getInputProps('date')} type="date" min={localScheduleNow().slice(0, 10)} />}
          </FormField>
          <FormField id="request-time" label="Hora aproximada (Bolivia)" required error={form.getError('time')}>
            {(control) => <Input {...control} {...form.getInputProps('time')} type="time" />}
          </FormField>
        </div>
        <FormField id="request-address" label="Dirección o ubicación del servicio" required error={form.getError('address')}
          hint="Solo se comparte con este profesional si se confirma la contratación.">
          {(control) => <Input {...control} {...form.getInputProps('address')} maxLength={300} />}
        </FormField>
        <FormField id="request-reference" label="Referencia adicional">
          {(control) => <Input {...control} {...form.getInputProps('reference')} maxLength={300} />}
        </FormField>
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 text-label text-ink">Presupuesto</legend>
          <div className="flex flex-wrap gap-4 text-label text-ink-muted">
            <label className="flex items-center gap-2">
              <input type="radio" name="pricing" className="accent-primary-600" checked={!form.values.priced}
                onChange={() => form.setFieldValue('priced', false)} />
              Solicitar cotización
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="pricing" className="accent-primary-600" checked={form.values.priced}
                onChange={() => form.setFieldValue('priced', true)} />
              Proponer un presupuesto
            </label>
          </div>
          {form.values.priced && (
            <FormField id="request-budget" label="Importe en Bs" required error={form.getError('budget')}
              hint="El importe es negociable hasta que ambas partes estén de acuerdo.">
              {(control) => <Input {...control} {...form.getInputProps('budget')} inputMode="decimal" maxLength={13} />}
            </FormField>
          )}
        </fieldset>
      </fieldset>
      {confirming && (
        <Alert tone="info">
          Confirma el envío a {getFullName(worker)}. Tu dirección y referencia se compartirán si se confirma el acuerdo.
        </Alert>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" leftIcon={ClipboardList} isLoading={form.isSubmitting} loadingText="Enviando...">
          {confirming ? 'Confirmar envío' : 'Revisar solicitud'}
        </Button>
        {confirming && (
          <Button variant="ghost" disabled={form.isSubmitting} onClick={() => setConfirming(false)}>Editar solicitud</Button>
        )}
      </div>
    </form>
  )
}

function WorkerRequest({ workerId }: { workerId: string }) {
  const load = useCallback(() => workersService.getById(workerId, null), [workerId])
  const worker = useAsyncData(load)
  const categories = useCategories()
  if (worker.status === 'loading' || categories.status === 'loading') {
    return <LoadingState label="Cargando el formulario..." />
  }
  if (worker.status === 'error') return <Alert>{worker.error.message}</Alert>
  if (categories.status === 'error') return <Alert>{categories.error.message}</Alert>
  const selectedWorker = worker.data
  if (!selectedWorker || selectedWorker.availability !== 'available') {
    return <Alert tone="info">El profesional no está disponible para recibir solicitudes nuevas.</Alert>
  }
  const specialties = categories.data.filter((category) => selectedWorker.categoryIds.includes(category.id))
  if (!specialties.length) return <Alert tone="info">El profesional no tiene especialidades disponibles.</Alert>
  return <RequestForm worker={selectedWorker} categories={specialties} />
}

export function RequestWorkerPage() {
  const { workerId = '' } = useParams()
  const { user } = useAuth()
  return (
    <div className="container-app pt-6 md:pt-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <PageHeader title="Solicitar servicio" backTo={buildWorkerDetailPath(workerId)} />
        <Card padding="lg">
          {user?.accountType === 'client'
            ? <WorkerRequest key={`${user.id}:${workerId}`} workerId={workerId} />
            : <Alert tone="info">Solo las cuentas de cliente pueden solicitar un servicio.</Alert>}
        </Card>
      </div>
    </div>
  )
}
