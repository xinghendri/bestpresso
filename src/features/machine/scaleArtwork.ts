import { supportedScaleForName } from '../../domain/scales'

const scaleImageSources = import.meta.glob('../../assets/figma/**/*.png', { eager: true, import: 'default' }) as Record<string, string>

export function scalePresentationForName(name: string | undefined) {
  const scale = supportedScaleForName(name)
  if (!scale) return undefined
  const imagePath = Object.keys(scaleImageSources).find((path) => path.endsWith(`/${scale.imageName}`))
  return { ...scale, imageSrc: imagePath ? scaleImageSources[imagePath] : undefined }
}
