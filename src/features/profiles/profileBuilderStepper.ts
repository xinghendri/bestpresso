export type BuilderStepperDirection = -1 | 1

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const rounded = (value: number) => Math.round(value * 10) / 10

export function nextBuilderStepperValue(
  value: number | null | undefined,
  direction: BuilderStepperDirection,
  step: number,
  min: number,
  max: number,
  wholeUnit: boolean,
) {
  const enabled = typeof value === 'number' && value > 0
  if (!enabled && direction < 0) return undefined
  const increment = wholeUnit ? 1 : step
  const base = enabled && typeof value === 'number' ? value : min > 0 ? min : increment
  const next = rounded(clamp(base + (enabled ? direction * increment : 0), min, max))
  return next <= 0 ? undefined : next
}
