import type { DecaidSettings } from '../../api/decaid/types'

// Decaid stores separate fields; Bestpresso exposes one universal yield setting.
export function hotWaterYieldLookAheadPatch(settings: DecaidSettings): Partial<DecaidSettings> {
  const value = settings.weightFlowMultiplier
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && settings.hotWaterFlowMultiplier !== value
    ? { hotWaterFlowMultiplier: value }
    : {}
}
