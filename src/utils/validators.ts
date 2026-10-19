const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
/** Bolivian mobile numbers: 8 digits starting with 6 or 7, optional +591 prefix. */
const BO_PHONE_PATTERN = /^(?:\+?591)?[67]\d{7}$/
const NAME_PATTERN = /^[\p{L}\s'-]+$/u

export const PASSWORD_MIN_LENGTH = 8

export function isEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim())
}

export function isPhone(value: string): boolean {
  return BO_PHONE_PATTERN.test(value.replace(/[\s-]/g, ''))
}

export function isPersonName(value: string): boolean {
  const trimmed = value.trim()
  return trimmed.length >= 2 && NAME_PATTERN.test(trimmed)
}

export interface PasswordChecks {
  minLength: boolean
  hasLetter: boolean
  hasNumber: boolean
}

export function getPasswordChecks(value: string): PasswordChecks {
  return {
    minLength: value.length >= PASSWORD_MIN_LENGTH,
    hasLetter: /\p{L}/u.test(value),
    hasNumber: /\d/.test(value),
  }
}

export function isStrongPassword(value: string): boolean {
  return Object.values(getPasswordChecks(value)).every(Boolean)
}
