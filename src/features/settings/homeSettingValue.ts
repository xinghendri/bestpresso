import type { MachineUtility } from '../../domain/brewing'

/** Homescreen targets are stored in Celsius; display conversion happens later. */
export function homeSettingValue(utility: MachineUtility | undefined, label: string): number | undefined {
  const raw = utility?.metrics.find((metric) => metric.label === label)?.value.trim()
  if (!raw) return undefined
  const value = Number(raw)
  return Number.isFinite(value) ? value : undefined
}
