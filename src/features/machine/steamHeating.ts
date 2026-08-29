export const MINIMUM_ENABLED_STEAM_TEMPERATURE_C = 135

export function isSteamHeatingEnabled(targetTemperature: number | undefined) {
  return typeof targetTemperature === 'number'
    && Number.isFinite(targetTemperature)
    && targetTemperature >= MINIMUM_ENABLED_STEAM_TEMPERATURE_C
}

export function steamTargetForToggle(enabled: boolean, displayedTarget: number) {
  if (!enabled) return 0
  return Number.isFinite(displayedTarget) && displayedTarget >= MINIMUM_ENABLED_STEAM_TEMPERATURE_C
    ? displayedTarget
    : MINIMUM_ENABLED_STEAM_TEMPERATURE_C
}
