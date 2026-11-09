import { useState } from 'react'
import { BriefcaseBusiness, Coins, MapPin, Save } from 'lucide-react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { useForm } from '@/hooks/useForm'
import { MAX_WORKER_CATEGORIES, profileService } from '@/services/profile.service'
import type { CatalogCategory, PricingMode, ServiceZone, WorkerProfile } from '@/types/profile'
import { PRICING_META } from '../pricing'
import {
  DESCRIPTION_MAX,
  PROFESSION_MAX,
  parseRate,
  requiresRate,
  toWorkerProfessionalValues,
  validateCategorySelection,
  validateWorkerProfessional,
  type WorkerProfessionalValues,
} from '../validation'
import { AvailabilitySelector } from './AvailabilitySelector'
import { CategorySelector } from './CategorySelector'
import { PricingModeSelector } from './PricingModeSelector'

export interface WorkerProfessionalFormProps {
  userId: string
  profile: WorkerProfile
  categories: CatalogCategory[]
  zones: ServiceZone[]
  onSaved: () => void
}

function sameIds(a: string[], b: string[]): boolean {
  return a.length === b.length && [...a].sort().every((id, index) => id === [...b].sort()[index])
}

function SectionTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col gap-0.5 border-t border-border/70 pt-5">
      <h3 className="text-heading text-ink">{title}</h3>
      <p className="text-caption text-ink-subtle">{description}</p>
    </div>
  )
}

export function WorkerProfessionalForm({ userId, profile, categories, zones, onSaved }: WorkerProfessionalFormProps) {
  const [categoryIds, setCategoryIds] = useState<string[]>(profile.categoryIds)
  const [categoriesTouched, setCategoriesTouched] = useState(false)
  const [saved, setSaved] = useState(false)

  const categoryError = validateCategorySelection(categoryIds)

  const form = useForm<WorkerProfessionalValues>({
    initialValues: toWorkerProfessionalValues(profile),
    validate: validateWorkerProfessional,
    onSubmit: async (values) => {
      setSaved(false)
      setCategoriesTouched(true)
      if (categoryError) throw new Error(categoryError)

      const pricingMode = values.pricingMode as PricingMode
      await profileService.updateWorkerProfile(userId, {
        profession: values.profession,
        description: values.description,
        experienceYears: Number(values.experienceYears),
        serviceRadiusKm: Number(values.serviceRadiusKm),
        availability: values.availability,
        serviceZoneId: values.serviceZoneId,
        pricingMode,
        baseRateBob: requiresRate(pricingMode) ? parseRate(values.baseRateBob) : null,
      })
      if (!sameIds(categoryIds, profile.categoryIds)) {
        await profileService.setWorkerCategories(categoryIds)
      }
      setSaved(true)
      onSaved()
    },
  })

  const descriptionLength = form.values.description.trim().length
  const showRate = requiresRate(form.values.pricingMode)

  return (
    <form
      onSubmit={form.handleSubmit}
      noValidate
      className="flex flex-col gap-6"
      aria-labelledby="worker-professional-title"
    >
      <h2 id="worker-professional-title" className="sr-only">
        Información profesional
      </h2>

      {form.submitError && <Alert>{form.submitError}</Alert>}
      {saved && !form.submitError && <Alert tone="success">Tu perfil profesional se guardó correctamente.</Alert>}

      <FormField
        id="worker-profession"
        label="Oficio o profesión"
        required
        error={form.getError('profession')}
        hint="Así te verán los clientes. Ej. Electricista domiciliario."
      >
        {({ invalid, ...control }) => (
          <Input
            {...control}
            {...form.getInputProps('profession')}
            invalid={invalid}
            maxLength={PROFESSION_MAX}
            placeholder="Ej. Plomero"
            leftIcon={BriefcaseBusiness}
          />
        )}
      </FormField>

      <FormField
        id="worker-description"
        label="Descripción de tus servicios"
        required
        error={form.getError('description')}
        hint={`${descriptionLength} / ${DESCRIPTION_MAX} caracteres. Mínimo 30. No incluyas tu dirección exacta ni datos de contacto.`}
      >
        {({ invalid, ...control }) => (
          <Textarea
            {...control}
            name="description"
            value={form.values.description}
            onChange={(event) => form.setFieldValue('description', event.target.value)}
            onBlur={form.handleBlur}
            invalid={invalid}
            maxLength={DESCRIPTION_MAX}
            placeholder="Cuenta qué trabajos realizas, tu especialidad y cómo trabajas."
          />
        )}
      </FormField>

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField id="worker-experience" label="Años de experiencia" required error={form.getError('experienceYears')}>
          {({ invalid, ...control }) => (
            <Input
              {...control}
              {...form.getInputProps('experienceYears')}
              invalid={invalid}
              type="number"
              inputMode="numeric"
              min={0}
              max={60}
              step={1}
              placeholder="Ej. 5"
            />
          )}
        </FormField>
      </div>

      <SectionTitle
        title="Zona de cobertura"
        description="Elige tu zona base. Nunca mostramos tu dirección exacta a los clientes."
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField id="worker-zone" label="Zona de trabajo" required error={form.getError('serviceZoneId')}>
          {({ invalid, ...control }) => (
            <Select
              {...control}
              name="serviceZoneId"
              value={form.values.serviceZoneId}
              onChange={(event) => {
                setSaved(false)
                form.setFieldValue('serviceZoneId', event.target.value)
              }}
              onBlur={form.handleBlur}
              invalid={invalid}
              leftIcon={MapPin}
              disabled={form.isSubmitting || zones.length === 0}
            >
              <option value="" disabled>
                {zones.length === 0 ? 'No hay zonas disponibles' : 'Selecciona una zona'}
              </option>
              {zones.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.name}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <FormField
          id="worker-radius"
          label="Radio de trabajo (km)"
          required
          error={form.getError('serviceRadiusKm')}
          hint="Distancia máxima que recorres desde tu zona."
        >
          {({ invalid, ...control }) => (
            <Input
              {...control}
              {...form.getInputProps('serviceRadiusKm')}
              invalid={invalid}
              type="number"
              inputMode="numeric"
              min={1}
              max={50}
              step={1}
            />
          )}
        </FormField>
      </div>

      <SectionTitle
        title="Precio orientativo"
        description="Es una referencia para el cliente. El precio final lo acuerdan según cada trabajo."
      />

      <PricingModeSelector
        name="pricingMode"
        value={form.values.pricingMode}
        onChange={(value) => {
          setSaved(false)
          form.setFieldValue('pricingMode', value)
          if (!requiresRate(value)) form.setFieldValue('baseRateBob', '')
        }}
        error={form.getError('pricingMode')}
        disabled={form.isSubmitting}
      />

      {showRate && (
        <FormField
          id="worker-rate"
          label={`Precio desde (Bs) ${PRICING_META[form.values.pricingMode as PricingMode].unit}`}
          required
          error={form.getError('baseRateBob')}
          hint="Monto mínimo aproximado en bolivianos. Ej. 80"
          className="sm:max-w-xs"
        >
          {({ invalid, ...control }) => (
            <Input
              {...control}
              {...form.getInputProps('baseRateBob')}
              invalid={invalid}
              inputMode="decimal"
              placeholder="Ej. 80"
              leftIcon={Coins}
              maxLength={9}
            />
          )}
        </FormField>
      )}

      <SectionTitle title="Disponibilidad y categorías" description="Indica si puedes tomar trabajos ahora y en qué rubros." />

      <AvailabilitySelector
        name="worker-availability"
        value={form.values.availability}
        onChange={(value) => {
          setSaved(false)
          form.setFieldValue('availability', value)
        }}
        disabled={form.isSubmitting}
      />

      <CategorySelector
        id="worker-categories"
        categories={categories}
        selected={categoryIds}
        max={MAX_WORKER_CATEGORIES}
        onChange={(ids) => {
          setSaved(false)
          setCategoriesTouched(true)
          setCategoryIds(ids)
        }}
        error={categoriesTouched ? categoryError : undefined}
        disabled={form.isSubmitting}
      />

      <div className="flex justify-end border-t border-border/70 pt-5">
        <Button
          type="submit"
          leftIcon={Save}
          isLoading={form.isSubmitting}
          loadingText="Guardando..."
          className="w-full sm:w-auto"
        >
          Guardar perfil profesional
        </Button>
      </div>
    </form>
  )
}
