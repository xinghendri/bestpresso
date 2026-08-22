import type { MachineReadiness } from '../../domain/brewing'
import type { MachineSnapshot } from './types'

const HEATING_ENTER_GAP_C = 1
const HEATING_EXIT_GAP_C = 0.5
const EXPLICIT_HEATING_STATES = new Set(['booting', 'heating', 'preheating'])
const THERMAL_HOLD_STATES = new Set(['espresso', 'hotwater', 'flush', 'steam', 'steamrinse', 'cleaning', 'descaling', 'calibration', 'selftest', 'airpurge'])

const finite = (value: number | undefined): value is number => value !== undefined && Number.isFinite(value)

const normalizedMachineState = (snapshot: MachineSnapshot) => {
  const machineState = typeof snapshot.state === 'string' ? { state: snapshot.state } : snapshot.state
  return machineState?.state?.toLowerCase()
}

const previousThermalReadiness = (previous?: MachineReadiness | null) => previous === 'notHeating' ? 'heating' : previous

export function readinessTemperatureSample(snapshot: MachineSnapshot) {
  const samples: Array<{ sensor: 'mix' | 'group'; current: number; target: number; gap: number }> = []
  if (finite(snapshot.mixTemperature) && finite(snapshot.targetMixTemperature)) samples.push({ sensor: 'mix', current: snapshot.mixTemperature, target: snapshot.targetMixTemperature, gap: snapshot.targetMixTemperature - snapshot.mixTemperature })
  if (finite(snapshot.groupTemperature) && finite(snapshot.targetGroupTemperature)) samples.push({ sensor: 'group', current: snapshot.groupTemperature, target: snapshot.targetGroupTemperature, gap: snapshot.targetGroupTemperature - snapshot.groupTemperature })
  return samples.sort((left, right) => right.gap - left.gap)[0]
}

export const readinessTemperatureGap = (snapshot: MachineSnapshot) => readinessTemperatureSample(snapshot)?.gap

export function readinessFromSnapshot(snapshot: MachineSnapshot, previous?: MachineReadiness | null): MachineReadiness {
  const state = normalizedMachineState(snapshot)
  const thermalPrevious = previousThermalReadiness(previous)

  if (state === 'sleeping') return 'sleeping'
  if (state === 'error') return 'disconnected'
  if (state === 'needswater') return 'thirsty'
  if (state && EXPLICIT_HEATING_STATES.has(state)) return 'heating'
  if (state && THERMAL_HOLD_STATES.has(state) && (thermalPrevious === 'ready' || thermalPrevious === 'heating')) return thermalPrevious

  const targetGap = readinessTemperatureGap(snapshot)
  if (targetGap === undefined) return thermalPrevious === 'ready' || thermalPrevious === 'heating' ? thermalPrevious : 'heating'
  if (thermalPrevious === 'heating') return targetGap > HEATING_EXIT_GAP_C ? 'heating' : 'ready'
  return targetGap >= HEATING_ENTER_GAP_C ? 'heating' : 'ready'
}
