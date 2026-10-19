import { useCallback, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'

export type FormValues = Record<string, string | boolean>
export type FormErrors<T extends FormValues> = Partial<Record<keyof T, string>>

export interface UseFormOptions<T extends FormValues> {
  initialValues: T
  validate: (values: T) => FormErrors<T>
  onSubmit: (values: T) => Promise<void> | void
}

/**
 * Minimal typed form state manager.
 * Errors are derived from values; they become visible after a field is
 * blurred or after the first submit attempt (avoids shouting while typing).
 */
export function useForm<T extends FormValues>({ initialValues, validate, onSubmit }: UseFormOptions<T>) {
  const [values, setValues] = useState<T>(initialValues)
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({})
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const errors = useMemo(() => validate(values), [validate, values])
  const isValid = Object.keys(errors).length === 0

  const getError = useCallback(
    (name: keyof T): string | undefined =>
      submitAttempted || touched[name] ? errors[name] : undefined,
    [errors, submitAttempted, touched],
  )

  const setFieldValue = useCallback(<K extends keyof T>(name: K, value: T[K]) => {
    setValues((prev) => ({ ...prev, [name]: value }))
    setSubmitError(null)
  }, [])

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const { name, type, checked, value } = event.target
      setFieldValue(name as keyof T, (type === 'checkbox' ? checked : value) as T[keyof T])
    },
    [setFieldValue],
  )

  const handleBlur = useCallback((event: { target: { name: string } }) => {
    const name = event.target.name as keyof T
    setTouched((prev) => (prev[name] ? prev : { ...prev, [name]: true }))
  }, [])

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      setSubmitAttempted(true)

      const firstInvalid = Object.keys(errors)[0]
      if (firstInvalid) {
        event.currentTarget.querySelector<HTMLElement>(`[name="${firstInvalid}"]`)?.focus()
        return
      }

      setIsSubmitting(true)
      setSubmitError(null)
      try {
        await onSubmit(values)
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : 'Ocurrió un error inesperado.')
      } finally {
        setIsSubmitting(false)
      }
    },
    [errors, onSubmit, values],
  )

  /** Spreads name/value/handlers onto a text-like input. */
  const getInputProps = useCallback(
    (name: keyof T & string) => ({
      name,
      value: String(values[name] ?? ''),
      onChange: handleChange,
      onBlur: handleBlur,
    }),
    [handleBlur, handleChange, values],
  )

  return {
    values,
    errors,
    isValid,
    isSubmitting,
    submitError,
    getError,
    getInputProps,
    setFieldValue,
    handleChange,
    handleBlur,
    handleSubmit,
  }
}
