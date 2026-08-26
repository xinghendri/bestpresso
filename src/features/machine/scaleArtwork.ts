import { supportedScaleForDevice } from '../../domain/scales'

const scaleImageSources = import.meta.glob('../../assets/figma/**/*.png', { eager: true, import: 'default' }) as Record<string, string>

export function scalePresentationForDevice(name: string | undefined, identifier: string | undefined) {
  const scale = supportedScaleForDevice(name, identifier)
  if (!scale) return undefined
  if (!('imageName' in scale)) return { ...scale, imageName: undefined, imageSrc: undefined }
  const imagePath = Object.keys(scaleImageSources).find((path) => path.endsWith(`/${scale.imageName}`))
  return { ...scale, imageSrc: imagePath ? scaleImageSources[imagePath] : undefined }
}
