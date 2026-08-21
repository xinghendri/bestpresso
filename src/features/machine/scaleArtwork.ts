import bookooThemisMiniImage from '../../assets/figma/bookoo-themis-mini.png'
import { supportedScaleForName } from '../../domain/scales'
import type { SupportedScaleId } from '../../domain/scales'

const scaleImageSources: Partial<Record<SupportedScaleId, string>> = {
  'bookoo-mini-scale': bookooThemisMiniImage,
}

export function scalePresentationForName(name: string | undefined) {
  const scale = supportedScaleForName(name)
  if (!scale) return undefined
  return { ...scale, imageSrc: scaleImageSources[scale.id] }
}
