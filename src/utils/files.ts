/* --------------------------------------------------------------------------
   Client-side file checks and image preparation for uploads.
   The Storage buckets enforce size and MIME type again (migrations 0004/0005);
   these checks only give the user an immediate, clear message.
   -------------------------------------------------------------------------- */

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const DOCUMENT_MIME_TYPES = [...IMAGE_MIME_TYPES, 'application/pdf'] as const

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
}

/** Returns a Spanish error message, or undefined when the file is acceptable. */
export function validateUploadFile(file: File, allowed: readonly string[]): string | undefined {
  if (!allowed.includes(file.type)) {
    return allowed.includes('application/pdf')
      ? 'Formato no admitido. Sube una imagen JPG, PNG o WEBP, o un archivo PDF.'
      : 'Formato no admitido. Sube una imagen JPG, PNG o WEBP.'
  }
  if (file.size === 0) return 'El archivo está vacío.'
  if (file.size > MAX_UPLOAD_BYTES) return 'El archivo supera el tamaño máximo de 5 MB.'
  return undefined
}

/**
 * Builds `<ownerId>/<prefix>-<random>.<ext>`. The extension comes from the MIME
 * type, never from the user's file name, so names cannot inject paths.
 */
export function buildStoragePath(ownerId: string, prefix: string, mimeType: string): string {
  const extension = EXTENSION_BY_MIME[mimeType] ?? 'bin'
  return `${ownerId}/${prefix}-${crypto.randomUUID()}.${extension}`
}

export interface PrepareImageOptions {
  /** Longest side in pixels after resizing. */
  maxDimension: number
  type: 'image/jpeg' | 'image/webp'
  quality: number
}

/**
 * Re-encodes an image through a canvas: applies EXIF orientation, limits its
 * size and DROPS ALL METADATA (including GPS location) before upload.
 * Falls back to the original file if the browser cannot decode it.
 */
export async function prepareImage(file: File, { maxDimension, type, quality }: PrepareImageOptions): Promise<File> {
  if (!file.type.startsWith('image/')) return file

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new Error('No se pudo leer la imagen. Prueba con otro archivo JPG, PNG o WEBP.')
  }

  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) {
    bitmap.close()
    return file
  }
  if (type === 'image/jpeg') {
    // JPEG has no transparency: paint a white background first.
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, width, height)
  }
  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality))
  if (!blob || blob.type !== type) {
    // Browser lacks the encoder (e.g. old Safari and WEBP): retry as JPEG.
    if (type !== 'image/jpeg') return prepareImage(file, { maxDimension, type: 'image/jpeg', quality })
    return file
  }
  return new File([blob], `image.${EXTENSION_BY_MIME[type]}`, { type })
}
