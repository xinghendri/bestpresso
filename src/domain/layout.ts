export const COMPACT_LANDSCAPE_MIN_WIDTH = 761
export const COMPACT_LANDSCAPE_MAX_HEIGHT = 680

export function isCompactLandscapeViewport(width: number, height: number) {
  return width >= COMPACT_LANDSCAPE_MIN_WIDTH && height <= COMPACT_LANDSCAPE_MAX_HEIGHT
}

export function formatViewportDiagnostics(width: number, height: number, pixelRatio: number, visualWidth = width, visualHeight = height) {
  const density = isCompactLandscapeViewport(width, height) ? 'compact' : 'standard'
  return `${Math.round(width)}×${Math.round(height)} · ${density} · DPR ${pixelRatio.toFixed(2)} · visual ${Math.round(visualWidth)}×${Math.round(visualHeight)}`
}
