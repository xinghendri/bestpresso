import type { MachineReadiness } from '../../domain/brewing'
import type { MachineSnapshot } from './types'

const NOT_HEATING_BELOW_C = 70
const READY_TARGET_TOLERANCE_C = 8
const TEMPERATURE_RISE_C = 0.3
const RISING_MEMORY_MS = 5_000
const NOT_HEATING_OBSERVATION_MS = 10_000

const EXPLICIT_HEATING_STATES = new Set(['booting', 'busy', 'heating', 'preheating'])
const READY_MACHINE_STATES = new Set(['idle', 'schedidle', 'ready'])
const OPERATION_STATES = new Set(['espresso', 'hotwater', 'flush', 'steam', 'steamrinse', 'cleaning', 'descaling', 'calibration', 'selftest', 'airpurge'])
const EXPLICIT_NOT_HEATING_STATES = new Set(['notheating', 'noheat', 'poweredoff'])
const EXPLICIT_NOT_HEATING_SUBSTATES = new Set(['errornoac'])

type ThermalReadiness = Extract<MachineReadiness, 'ready' | 'heating' | 'notHeating'>
type TemperatureSensor = 'mix' | 'group'

interface TemperatureReading {
  sensor: TemperatureSensor
  current: number
  target?: number
  gap?: number
}

interface SensorProgress {
  lowest: number
}

const finite = (value: number | undefined): value is number => value !== undefined && Number.isFinite(value)

const normalizedMachineState = (snapshot: MachineSnapshot) => {
  const machineState = typeof snapshot.state === 'string' ? { state: snapshot.state } : snapshot.state
  return {
    state: machineState?.state?.toLowerCase(),
    substate: machineState?.substate?.toLowerCase(),
  }
}

const temperatureReadings = (snapshot: MachineSnapshot) => {
  const readings: TemperatureReading[] = []
  if (finite(snapshot.mixTemperature)) {
    const target = finite(snapshot.targetMixTemperature) ? snapshot.targetMixTemperature : undefined
    readings.push({ sensor: 'mix', current: snapshot.mixTemperature, target, gap: target === undefined ? undefined : target - snapshot.mixTemperature })
  }
  if (finite(snapshot.groupTemperature)) {
    const target = finite(snapshot.targetGroupTemperature) ? snapshot.targetGroupTemperature : undefined
    readings.push({ sensor: 'group', current: snapshot.groupTemperature, target, gap: target === undefined ? undefined : target - snapshot.groupTemperature })
  }
  return readings
}

export function readinessTemperatureSample(snapshot: MachineSnapshot) {
  return temperatureReadings(snapshot)
    .filter((reading): reading is TemperatureReading & { target: number; gap: number } => reading.target !== undefined && reading.gap !== undefined)
    .sort((left, right) => right.gap - left.gap)[0]
}

const isWithinReadyTemperature = (snapshot: MachineSnapshot) => {
  const targetedReadings = temperatureReadings(snapshot).filter(
    (reading): reading is TemperatureReading & { target: number; gap: number } =>
      reading.target !== undefined && reading.target > 0 && reading.gap !== undefined,
  )

  if (targetedReadings.length > 0) {
    return targetedReadings.every((reading) => reading.gap <= READY_TARGET_TOLERANCE_C)
  }

  const readings = temperatureReadings(snapshot)
  return readings.length > 0 && readings.every((reading) => reading.current >= NOT_HEATING_BELOW_C)
}

export function createMachineReadinessTracker() {
  let thermalState: ThermalReadiness | null = null
  let operationState: Exclude<ThermalReadiness, 'notHeating'> | null = null
  let sensorProgress: Partial<Record<TemperatureSensor, SensorProgress>> = {}
  let lastRiseAt: number | null = null
  let coldStallStartedAt: number | null = null

  const reset = () => {
    thermalState = null
    operationState = null
    sensorProgress = {}
    lastRiseAt = null
    coldStallStartedAt = null
  }

  const commit = (readiness: ThermalReadiness) => {
    thermalState = readiness
    return readiness
  }

  const observeTemperature = (snapshot: MachineSnapshot, now: number) => {
    const readings = temperatureReadings(snapshot)
    let rose = false
    const availableSensors = new Set<TemperatureSensor>()

    for (const reading of readings) {
      availableSensors.add(reading.sensor)
      const progress = sensorProgress[reading.sensor]
      if (!progress) {
        sensorProgress[reading.sensor] = { lowest: reading.current }
        continue
      }
      progress.lowest = Math.min(progress.lowest, reading.current)
      if (reading.current >= progress.lowest + TEMPERATURE_RISE_C) {
        rose = true
        progress.lowest = reading.current
      }
    }

    for (const sensor of ['mix', 'group'] as const) {
      if (!availableSensors.has(sensor)) delete sensorProgress[sensor]
    }

    if (rose) lastRiseAt = now
    const rising = lastRiseAt !== null && now - lastRiseAt <= RISING_MEMORY_MS
    const observedTemperature = readings.length ? Math.min(...readings.map((reading) => reading.current)) : undefined
    const cold = observedTemperature !== undefined && observedTemperature < NOT_HEATING_BELOW_C

    if (cold && !rising) coldStallStartedAt ??= now
    else coldStallStartedAt = null

    return {
      rising,
      stalledCold: cold && coldStallStartedAt !== null && now - coldStallStartedAt >= NOT_HEATING_OBSERVATION_MS,
    }
  }

  const evaluate = (snapshot: MachineSnapshot, now = Date.now()): MachineReadiness => {
    const { state, substate } = normalizedMachineState(snapshot)
    const machineSignalsReady = state !== undefined && READY_MACHINE_STATES.has(state) && substate !== 'preparingforshot'
    const machineSignalsHeating = (state !== undefined && EXPLICIT_HEATING_STATES.has(state)) || substate === 'preparingforshot'
    const machineSignalsNotHeating = (state !== undefined && EXPLICIT_NOT_HEATING_STATES.has(state)) || (substate !== undefined && EXPLICIT_NOT_HEATING_SUBSTATES.has(substate))

    if (state === 'sleeping') {
      operationState = null
      return 'sleeping'
    }
    if (state === 'needswater') {
      operationState = null
      return 'thirsty'
    }

    if (machineSignalsNotHeating) {
      operationState = null
      return commit('notHeating')
    }
    if (state === 'error') {
      operationState = null
      return thermalState ?? commit('heating')
    }

    if (state !== undefined && OPERATION_STATES.has(state)) {
      operationState ??= thermalState === 'ready' ? 'ready' : 'heating'
      return commit(operationState)
    }
    operationState = null

    // Decaid exposes the machine state and brew-path temperatures in the
    // snapshot, but no separate physical-power/safety flag. An idle machine can
    // therefore still be cold with its physical power button off. Treat idle as
    // ready only when the brew path is within the same 8 C recovery allowance
    // used after a shot or flush.
    const temperature = observeTemperature(snapshot, now)

    if (machineSignalsReady && isWithinReadyTemperature(snapshot)) {
      operationState = null
      sensorProgress = {}
      lastRiseAt = null
      coldStallStartedAt = null
      return commit('ready')
    }

    if (temperature.stalledCold) return commit('notHeating')
    if (machineSignalsHeating || temperature.rising) return commit('heating')

    // A nominally idle machine outside the ready band is not ready. Keep it in
    // heating while the cold-stall observation runs instead of carrying a stale
    // Ready state forward from before a disconnect, flush, or power-off.
    if (machineSignalsReady) return commit('heating')

    // Unknown future states retain the last trustworthy thermal state. Known
    // non-ready states without enough history begin as Heating.
    return thermalState ?? commit('heating')
  }

  return { evaluate, reset }
}
