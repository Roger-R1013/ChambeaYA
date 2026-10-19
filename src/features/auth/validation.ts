import type { FormErrors } from '@/hooks/useForm'
import { isEmail, isPersonName, isPhone, isStrongPassword } from '@/utils/validators'

export type LoginFormValues = {
  email: string
  password: string
  rememberMe: boolean
}

export type RegisterFormValues = {
  firstName: string
  lastName: string
  email: string
  phone: string
  password: string
  confirmPassword: string
  acceptTerms: boolean
}

export const LOGIN_INITIAL_VALUES: LoginFormValues = {
  email: '',
  password: '',
  rememberMe: true,
}

export const REGISTER_INITIAL_VALUES: RegisterFormValues = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
  acceptTerms: false,
}

function validateEmail(email: string): string | undefined {
  if (!email.trim()) return 'Ingresa tu correo electrónico.'
  if (!isEmail(email)) return 'Ingresa un correo electrónico válido.'
  return undefined
}

function validateName(value: string, field: 'nombre' | 'apellido'): string | undefined {
  if (!value.trim()) return `Ingresa tu ${field}.`
  if (!isPersonName(value)) return `El ${field} solo puede contener letras (mínimo 2).`
  return undefined
}

/** Removes keys with undefined messages so `Object.keys(errors)` reflects real errors. */
function compact<T extends Record<string, string | boolean>>(
  errors: Partial<Record<keyof T, string | undefined>>,
): FormErrors<T> {
  return Object.fromEntries(Object.entries(errors).filter(([, message]) => Boolean(message))) as FormErrors<T>
}

export function validateLogin(values: LoginFormValues): FormErrors<LoginFormValues> {
  return compact<LoginFormValues>({
    email: validateEmail(values.email),
    password: values.password ? undefined : 'Ingresa tu contraseña.',
  })
}

export function validateRegister(values: RegisterFormValues): FormErrors<RegisterFormValues> {
  return compact<RegisterFormValues>({
    firstName: validateName(values.firstName, 'nombre'),
    lastName: validateName(values.lastName, 'apellido'),
    email: validateEmail(values.email),
    phone: !values.phone.trim()
      ? 'Ingresa tu número de teléfono.'
      : !isPhone(values.phone)
        ? 'Ingresa un celular válido de 8 dígitos (ej. 71234567).'
        : undefined,
    password: !values.password
      ? 'Crea una contraseña.'
      : !isStrongPassword(values.password)
        ? 'La contraseña no cumple los requisitos.'
        : undefined,
    confirmPassword: !values.confirmPassword
      ? 'Confirma tu contraseña.'
      : values.confirmPassword !== values.password
        ? 'Las contraseñas no coinciden.'
        : undefined,
    acceptTerms: values.acceptTerms ? undefined : 'Debes aceptar los términos y condiciones.',
  })
}
