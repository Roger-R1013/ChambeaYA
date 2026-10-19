import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ArrowRight } from 'lucide-react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { ROUTES } from '@/config/routes'
import { AuthPageHeader } from '@/features/auth/components/AuthPageHeader'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { ACCOUNT_TYPE_OPTIONS } from '@/features/onboarding/accountTypes'
import { AccountTypeCard } from '@/features/onboarding/components/AccountTypeCard'
import type { AccountType } from '@/types/user'

export function AccountTypePage() {
  const { user, selectAccountType } = useAuth()
  const navigate = useNavigate()
  const [selected, setSelected] = useState<AccountType | null>(user?.accountType ?? null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleContinue() {
    if (!selected) return
    setIsSaving(true)
    setError(null)
    try {
      await selectAccountType(selected)
      navigate(ROUTES.home, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar tu elección.')
      setIsSaving(false)
    }
  }

  return (
    <div className="animate-fade-up">
      <AuthPageHeader
        eyebrow="Paso 2 de 2"
        title="¿Cómo quieres usar ChambeaYA!?"
        description="Elige el tipo de cuenta que mejor se adapta a ti. Podrás cambiarlo más adelante."
      />

      <fieldset className="flex flex-col gap-4">
        <legend className="sr-only">Tipo de cuenta</legend>
        {ACCOUNT_TYPE_OPTIONS.map((option) => (
          <AccountTypeCard
            key={option.value}
            option={option}
            name="account-type"
            checked={selected === option.value}
            onSelect={setSelected}
          />
        ))}
      </fieldset>

      {error && <Alert className="mt-5">{error}</Alert>}

      <Button
        size="lg"
        fullWidth
        className="mt-8"
        disabled={!selected}
        isLoading={isSaving}
        loadingText="Guardando..."
        rightIcon={ArrowRight}
        onClick={handleContinue}
      >
        Continuar
      </Button>
    </div>
  )
}
