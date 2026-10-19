import { useState } from 'react'
import { Eye, EyeOff, Lock } from 'lucide-react'
import { IconButton } from './IconButton'
import { Input, type InputProps } from './Input'

export type PasswordInputProps = Omit<InputProps, 'type' | 'rightSlot'>

export function PasswordInput({ leftIcon = Lock, ...rest }: PasswordInputProps) {
  const [isVisible, setIsVisible] = useState(false)

  return (
    <Input
      {...rest}
      leftIcon={leftIcon}
      type={isVisible ? 'text' : 'password'}
      rightSlot={
        <IconButton
          icon={isVisible ? EyeOff : Eye}
          label={isVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-pressed={isVisible}
          size="sm"
          onClick={() => setIsVisible((value) => !value)}
        />
      }
    />
  )
}
