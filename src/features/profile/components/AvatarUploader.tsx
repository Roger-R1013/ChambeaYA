import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Camera, Trash2 } from 'lucide-react'
import { Alert } from '@/components/ui/Alert'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { profileService } from '@/services/profile.service'
import type { User } from '@/types/user'
import { IMAGE_MIME_TYPES, validateUploadFile } from '@/utils/files'
import { getFullName } from '@/utils/format'

type Status = { kind: 'idle' } | { kind: 'busy'; action: 'upload' | 'remove' } | { kind: 'error'; message: string } | { kind: 'success'; message: string }

/**
 * Profile photo editor. The photo is PUBLIC (it identifies the worker in the
 * directory), so the copy reminds users not to upload documents here.
 */
export function AvatarUploader({ user }: { user: User }) {
  const { refreshProfile } = useAuth()
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const fullName = getFullName(user)
  const isBusy = status.kind === 'busy'

  // Release the local preview URL when it changes or the component unmounts.
  useEffect(() => {
    if (!preview) return
    return () => URL.revokeObjectURL(preview)
  }, [preview])

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    const invalid = validateUploadFile(file, IMAGE_MIME_TYPES)
    if (invalid) {
      setStatus({ kind: 'error', message: invalid })
      return
    }

    setPreview(URL.createObjectURL(file))
    setStatus({ kind: 'busy', action: 'upload' })
    try {
      await profileService.uploadAvatar(user.id, file, user.avatarUrl)
      await refreshProfile()
      setStatus({ kind: 'success', message: 'Tu foto de perfil se actualizó correctamente.' })
    } catch (error) {
      setStatus({ kind: 'error', message: error instanceof Error ? error.message : 'No se pudo subir la foto.' })
    } finally {
      setPreview(null)
    }
  }

  async function handleRemove() {
    setStatus({ kind: 'busy', action: 'remove' })
    try {
      await profileService.removeAvatar(user.id, user.avatarUrl)
      await refreshProfile()
      setStatus({ kind: 'success', message: 'Quitaste tu foto de perfil.' })
    } catch (error) {
      setStatus({ kind: 'error', message: error instanceof Error ? error.message : 'No se pudo quitar la foto.' })
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 id="avatar-title" className="text-heading text-ink">
        Foto de perfil
      </h2>

      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-5">
        <div className="relative">
          <Avatar name={fullName} src={preview ?? user.avatarUrl} size="xl" className={isBusy ? 'opacity-60' : undefined} />
          {isBusy && (
            <span className="absolute inset-0 flex items-center justify-center" aria-hidden>
              <span className="size-8 animate-spin rounded-full border-[3px] border-white border-t-primary-600" />
            </span>
          )}
        </div>

        <div className="flex w-full flex-col gap-3 sm:w-auto">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              ref={inputRef}
              id="avatar-file"
              type="file"
              accept={IMAGE_MIME_TYPES.join(',')}
              className="sr-only"
              onChange={handleFile}
              disabled={isBusy}
              tabIndex={-1}
              aria-hidden
            />
            <Button
              variant="secondary"
              leftIcon={Camera}
              onClick={() => inputRef.current?.click()}
              isLoading={status.kind === 'busy' && status.action === 'upload'}
              loadingText="Subiendo..."
              disabled={isBusy}
            >
              {user.avatarUrl ? 'Cambiar foto' : 'Subir foto'}
            </Button>
            {user.avatarUrl && (
              <Button
                variant="ghost"
                leftIcon={Trash2}
                onClick={handleRemove}
                isLoading={status.kind === 'busy' && status.action === 'remove'}
                loadingText="Quitando..."
                disabled={isBusy}
              >
                Quitar foto
              </Button>
            )}
          </div>
          <p className="text-caption text-ink-subtle">
            JPG, PNG o WEBP de hasta 5 MB. Esta foto es pública: no subas documentos de identidad aquí. Eliminamos los
            datos de ubicación de la imagen antes de guardarla.
          </p>
        </div>
      </div>

      {status.kind === 'error' && <Alert>{status.message}</Alert>}
      {status.kind === 'success' && <Alert tone="success">{status.message}</Alert>}
    </div>
  )
}
