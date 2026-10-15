import { useEffect, useState } from 'react'

/** Milk Assist: steam time scaled to the weighed milk (1 g treated as 1 ml).
    Bounds mirror SETTINGS_PROTOCOL.steam.duration. */

export const STEAM_DURATION_MIN_S = 10
export const STEAM_DURATION_MAX_S = 120
export const MILK_PRESENCE_THRESHOLD_G = 10
export const MIN_CALIBRATION_SECONDS = 5

export function clampSteamDuration(seconds: number): number {
  return Math.max(STEAM_DURATION_MIN_S, Math.min(STEAM_DURATION_MAX_S, Math.round(seconds)))
}

export function suggestedSteamSeconds(milkGrams: number, calGrams: number | null, calSeconds: number | null): number | null {
  if (!calGrams || !calSeconds || calGrams <= 0) return null
  return clampSteamDuration(milkGrams * calSeconds / calGrams)
}

export function ratePer150Ml(calGrams: number, calSeconds: number): number {
  return Math.round(calSeconds * 150 / calGrams)
}

export interface LiveSuggestion { milkGrams: number; seconds: number }

export function liveSuggestion(input: { scaleConnected: boolean; scaleGrams: number | undefined; jugGrams: number | null; calGrams: number | null; calSeconds: number | null }): LiveSuggestion | null {
  const { scaleConnected, scaleGrams, jugGrams, calGrams, calSeconds } = input
  if (!scaleConnected || scaleGrams === undefined || !Number.isFinite(scaleGrams) || jugGrams === null) return null
  const milkGrams = Math.round((scaleGrams - jugGrams) * 10) / 10
  if (milkGrams <= MILK_PRESENCE_THRESHOLD_G) return null
  const seconds = suggestedSteamSeconds(milkGrams, calGrams, calSeconds)
  return seconds === null ? null : { milkGrams, seconds }
}

export interface MilkAssistState {
  enabled: boolean
  jugGrams: number | null
  calGrams: number | null
  calSeconds: number | null
  pendingRestoreSeconds: number | null
}

export const MILK_ASSIST_KEY = 'bestpresso.milkAssist.v1'
const changeEvent = 'bestpresso:milk-assist-changed'

export const DEFAULT_MILK_ASSIST: MilkAssistState = { enabled: false, jugGrams: null, calGrams: null, calSeconds: null, pendingRestoreSeconds: null }

const grams = (value: unknown): number | null => {
  const number = typeof value === 'number' ? value : Number.NaN
  return Number.isFinite(number) && number > 0 ? Math.round(number) : null
}

// Any duration the workflow can hold must survive storage, or a pending restore is lost.
const restoreSeconds = (value: unknown): number | null => {
  const rounded = grams(value)
  return rounded !== null && rounded <= STEAM_DURATION_MAX_S ? rounded : null
}

const calibrationSeconds = (value: unknown): number | null => {
  const rounded = grams(value)
  return rounded !== null && rounded >= MIN_CALIBRATION_SECONDS && rounded <= STEAM_DURATION_MAX_S ? rounded : null
}

export function normalizeMilkAssist(value: unknown): MilkAssistState {
  const candidate = value && typeof value === 'object' ? value as Partial<MilkAssistState> : {}
  return {
    enabled: candidate.enabled === true,
    jugGrams: grams(candidate.jugGrams),
    calGrams: grams(candidate.calGrams),
    calSeconds: calibrationSeconds(candidate.calSeconds),
    pendingRestoreSeconds: restoreSeconds(candidate.pendingRestoreSeconds),
  }
}

export function readMilkAssist(): MilkAssistState {
  if (typeof window === 'undefined') return DEFAULT_MILK_ASSIST
  try {
    const stored = window.localStorage.getItem(MILK_ASSIST_KEY)
    return normalizeMilkAssist(stored ? JSON.parse(stored) : undefined)
  } catch {
    return DEFAULT_MILK_ASSIST
  }
}

export function writeMilkAssist(patch: Partial<MilkAssistState>): MilkAssistState {
  const next = normalizeMilkAssist({ ...readMilkAssist(), ...patch })
  try {
    window.localStorage.setItem(MILK_ASSIST_KEY, JSON.stringify(next))
  } catch {
    // The current session can still use the values when storage is unavailable.
  }
  window.dispatchEvent(new CustomEvent(changeEvent, { detail: next }))
  return next
}

export function useMilkAssist() {
  const [milkAssist, setMilkAssist] = useState(readMilkAssist)
  useEffect(() => {
    const onChange = (event: Event) => setMilkAssist((event as CustomEvent<MilkAssistState>).detail ?? readMilkAssist())
    const onStorage = (event: StorageEvent) => {
      if (event.key === MILK_ASSIST_KEY || event.key === null) setMilkAssist(readMilkAssist())
    }
    window.addEventListener(changeEvent, onChange)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(changeEvent, onChange)
      window.removeEventListener('storage', onStorage)
    }
  }, [])
  return { milkAssist, updateMilkAssist: writeMilkAssist }
}

export type WizardStep =
  | { step: 'jug'; savedJugGrams: number | null }
  | { step: 'milk'; jugGrams: number }
  | { step: 'steam'; jugGrams: number; milkGrams: number; phase: 'waiting' | 'running' | 'captured' | 'tooShort' | 'reachedMax'; elapsedSeconds: number }

export function wizardInit(savedJugGrams: number | null): WizardStep {
  return { step: 'jug', savedJugGrams }
}

export function wizardCaptureJug(jugGrams: number): WizardStep {
  return { step: 'milk', jugGrams: Math.round(jugGrams) }
}

export function wizardCaptureMilk(state: WizardStep, scaleGrams: number): WizardStep {
  if (state.step !== 'milk') return state
  const milkGrams = Math.round(scaleGrams - state.jugGrams)
  if (milkGrams <= 0) return state
  return { step: 'steam', jugGrams: state.jugGrams, milkGrams, phase: 'waiting', elapsedSeconds: 0 }
}

export function wizardSteamEvent(state: WizardStep, event: { kind: 'started' } | { kind: 'tick'; elapsedSeconds: number } | { kind: 'ended' }): WizardStep {
  if (state.step !== 'steam') return state
  if (event.kind === 'started') return state.phase === 'waiting' ? { ...state, phase: 'running', elapsedSeconds: 0 } : state
  if (state.phase !== 'running') return state
  if (event.kind === 'tick') {
    return event.elapsedSeconds >= STEAM_DURATION_MAX_S
      ? { ...state, phase: 'reachedMax', elapsedSeconds: STEAM_DURATION_MAX_S }
      : { ...state, elapsedSeconds: event.elapsedSeconds }
  }
  const rounded = Math.round(state.elapsedSeconds)
  return rounded < MIN_CALIBRATION_SECONDS ? { ...state, phase: 'tooShort', elapsedSeconds: rounded } : { ...state, phase: 'captured', elapsedSeconds: rounded }
}

export function wizardAdjustCapturedSeconds(state: WizardStep, seconds: number): WizardStep {
  if (state.step !== 'steam' || state.phase !== 'captured') return state
  const bounded = Math.max(MIN_CALIBRATION_SECONDS, Math.min(STEAM_DURATION_MAX_S, Math.round(seconds)))
  return { ...state, elapsedSeconds: bounded }
}

const STABILITY_WINDOW_MS = 1500
const STABILITY_TOLERANCE_G = 1

export function stableWeight(samples: { grams: number; atMs: number }[], nowMs: number): number | null {
  if (!samples.length || samples[0].atMs > nowMs - STABILITY_WINDOW_MS) return null
  const window = samples.filter((sample) => sample.atMs >= nowMs - STABILITY_WINDOW_MS)
  const reference = samples.at(-1)!.grams
  if (!window.length || window.some((sample) => Math.abs(sample.grams - reference) > STABILITY_TOLERANCE_G)) return null
  return Math.round(reference)
}
