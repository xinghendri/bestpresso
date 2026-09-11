import { useEffect, useState } from 'react'
import type { TemperatureUnit } from '../../domain/temperature'
import type { ClockFormat } from '../sleep/deviceTime'

export type ChartLineWeight = 'fine' | 'standard' | 'bold'

export interface BestpressoPreferences {
  completionSoundEnabled: boolean
  waterWarningLevelMl: number
  waterCriticalLevelMl: number
  chartLineWeight: ChartLineWeight
  temperatureUnit: TemperatureUnit
  clockFormat: ClockFormat
  screensaverBrightness: number
}

export const BESTPRESSO_PREFERENCES_KEY = 'bestpresso.preferences.v1'
const preferenceEvent = 'bestpresso:preferences-changed'

export const DEFAULT_BESTPRESSO_PREFERENCES: BestpressoPreferences = {
  completionSoundEnabled: true,
  waterWarningLevelMl: 426,
  waterCriticalLevelMl: 300,
  chartLineWeight: 'fine',
  temperatureUnit: 'C',
  clockFormat: 'device',
  screensaverBrightness: 7,
}

const finiteRange = (value: unknown, fallback: number) => {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? Math.round(Math.max(0, Math.min(2_000, number))) : fallback
}

export function normalizeBestpressoPreferences(value: unknown): BestpressoPreferences {
  const candidate = value && typeof value === 'object' ? value as Partial<BestpressoPreferences> : {}
  const critical = finiteRange(candidate.waterCriticalLevelMl, DEFAULT_BESTPRESSO_PREFERENCES.waterCriticalLevelMl)
  const warning = Math.max(critical + 1, finiteRange(candidate.waterWarningLevelMl, DEFAULT_BESTPRESSO_PREFERENCES.waterWarningLevelMl))
  const chartLineWeight = candidate.chartLineWeight === 'standard' || candidate.chartLineWeight === 'bold'
    ? candidate.chartLineWeight
    : 'fine'
  const temperatureUnit = candidate.temperatureUnit === 'F' ? 'F' : 'C'
  return {
    completionSoundEnabled: candidate.completionSoundEnabled !== false,
    screensaverBrightness: typeof candidate.screensaverBrightness === 'number' && Number.isFinite(candidate.screensaverBrightness)
      ? Math.round(Math.max(0, Math.min(100, candidate.screensaverBrightness)))
      : DEFAULT_BESTPRESSO_PREFERENCES.screensaverBrightness,
    waterWarningLevelMl: Math.min(2_000, warning),
    waterCriticalLevelMl: Math.min(1_999, critical),
    chartLineWeight,
    temperatureUnit,
    clockFormat: candidate.clockFormat === '12h' || candidate.clockFormat === '24h' ? candidate.clockFormat : 'device',
  }
}

export function readBestpressoPreferences() {
  if (typeof window === 'undefined') return DEFAULT_BESTPRESSO_PREFERENCES
  try {
    const stored = window.localStorage.getItem(BESTPRESSO_PREFERENCES_KEY)
    return normalizeBestpressoPreferences(stored ? JSON.parse(stored) : undefined)
  } catch {
    return DEFAULT_BESTPRESSO_PREFERENCES
  }
}

export function applyBestpressoPreferences(preferences = readBestpressoPreferences()) {
  if (typeof document !== 'undefined') document.documentElement.dataset.chartLineWeight = preferences.chartLineWeight
  return preferences
}

export function writeBestpressoPreferences(patch: Partial<BestpressoPreferences>) {
  const next = normalizeBestpressoPreferences({ ...readBestpressoPreferences(), ...patch })
  try {
    window.localStorage.setItem(BESTPRESSO_PREFERENCES_KEY, JSON.stringify(next))
  } catch {
    // The current session can still use the selection when storage is unavailable.
  }
  applyBestpressoPreferences(next)
  window.dispatchEvent(new CustomEvent(preferenceEvent, { detail: next }))
  return next
}

export function useBestpressoPreferences() {
  const [preferences, setPreferences] = useState(readBestpressoPreferences)
  useEffect(() => {
    const onPreference = (event: Event) => setPreferences((event as CustomEvent<BestpressoPreferences>).detail ?? readBestpressoPreferences())
    const onStorage = (event: StorageEvent) => {
      if (event.key === BESTPRESSO_PREFERENCES_KEY) setPreferences(readBestpressoPreferences())
    }
    window.addEventListener(preferenceEvent, onPreference)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(preferenceEvent, onPreference)
      window.removeEventListener('storage', onStorage)
    }
  }, [])
  return {
    preferences,
    updatePreferences: writeBestpressoPreferences,
    resetPreferences: () => writeBestpressoPreferences(DEFAULT_BESTPRESSO_PREFERENCES),
  }
}
