import type { BrewingScreenModel, MachineReadiness, MachineUtility, ScaleConnection } from '../../domain/brewing.ts'

/** Fixture values are not evidence of the machine's heater state at startup. */
export function withUnknownSteamState(model: BrewingScreenModel): BrewingScreenModel {
  return replaceUtility(model, 'steam', utility => ({
    ...utility,
    enabled: undefined,
    metrics: utility.metrics.map(metric => metric.id === 'current' ? { ...metric, value: '—', highlight: false } : metric),
  }))
}

export function withScaleConnection(current: ScaleConnection, next: ScaleConnection): ScaleConnection {
  return current.status === next.status && current.id === next.id && current.name === next.name ? current : next
}

// Display-only structural sharing: raw samples, readiness tracking and shot
// recording run before these helpers and are never filtered or throttled.
function replaceUtility(model: BrewingScreenModel, id: MachineUtility['id'], update: (utility: MachineUtility) => MachineUtility): BrewingScreenModel {
  let changed = false
  const utilities = model.utilities.map(utility => {
    const next = utility.id === id ? update(utility) : utility
    changed ||= next !== utility
    return next
  })
  return changed ? { ...model, utilities } : model
}

export function withDisplayedScaleWeight(model: BrewingScreenModel, weight: number) {
  const value = weight.toFixed(1)
  return replaceUtility(model, 'scale', utility => utility.metrics.every(metric => metric.value === value)
    ? utility : { ...utility, metrics: utility.metrics.map(metric => metric.value === value ? metric : { ...metric, value }) })
}

export function withHomeMachineDisplay(model: BrewingScreenModel, readiness: MachineReadiness, temperature: number | undefined, heatingThreshold: number, tankState: string) {
  let next = model.readiness === readiness ? model : { ...model, readiness }
  if (temperature !== undefined) {
    const value = String(Math.round(temperature)), highlight = temperature < heatingThreshold
    next = replaceUtility(next, 'steam', utility => {
      if (utility.metrics.every(metric => metric.id !== 'current' || (metric.value === value && metric.highlight === highlight))) return utility
      return { ...utility, metrics: utility.metrics.map(metric => metric.id === 'current' ? { ...metric, value, highlight } : metric) }
    })
  }
  return replaceUtility(next, 'tank', utility => {
    const alert = tankState === 'needsWater', warning = tankState === 'warning'
    return utility.alert === alert && utility.warning === warning ? utility : { ...utility, alert, warning }
  })
}

export function withHomeTankDisplay(model: BrewingScreenModel, value: string, levelPercent: number, tankState: string) {
  return replaceUtility(model, 'tank', utility => {
    const alert = tankState === 'needsWater', warning = tankState === 'warning'
    if (utility.alert === alert && utility.warning === warning && Object.is(utility.levelPercent, levelPercent) && utility.metrics.every(metric => metric.value === value)) return utility
    return { ...utility, alert, warning, levelPercent, metrics: utility.metrics.map(metric => metric.value === value ? metric : { ...metric, value }) }
  })
}
