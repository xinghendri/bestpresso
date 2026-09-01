interface SnapshotWithState {
  state?: string | { state?: string; substate?: string }
  profileFrame?: number
}

const ESPRESSO_EXTRACTION_SUBSTATES = new Set(['preinfusion', 'pouring'])
const DEFINITIVE_NON_ESPRESSO_STATES = new Set(['sleeping', 'hotwater', 'flush', 'steam', 'cleaning', 'descaling', 'transportmode', 'needswater', 'error'])
export const SKIP_TRANSITION_TIMEOUT_MS = 2_000

export interface SkipTransition {
  requestedAt: number
  fromFrame?: number
  sawSkipState: boolean
}

export interface SkipTransitionObservation {
  transition: SkipTransition | null
  keepShotActive: boolean
  acceptTelemetry: boolean
}

const snapshotState = (snapshot: SnapshotWithState) => (typeof snapshot.state === 'string' ? snapshot.state : snapshot.state?.state)?.toLowerCase()

export function isEspressoExtractionSnapshot(snapshot: SnapshotWithState, shotInProgress = false) {
  const state = snapshotState(snapshot)
  const substate = (typeof snapshot.state === 'object' ? snapshot.state?.substate : undefined)?.toLowerCase()
  if (state === 'skipstep') return shotInProgress
  if (state && state !== 'espresso') return false
  if (substate) return ESPRESSO_EXTRACTION_SUBSTATES.has(substate)
  return state === 'espresso'
}

export function beginSkipTransition(fromFrame: number | undefined, requestedAt: number): SkipTransition {
  return {
    requestedAt,
    fromFrame: typeof fromFrame === 'number' && Number.isFinite(fromFrame) ? fromFrame : undefined,
    sawSkipState: false,
  }
}

export function observeSkipTransition(snapshot: SnapshotWithState, transition: SkipTransition | null, now: number, shotInProgress: boolean): SkipTransitionObservation {
  const extracting = isEspressoExtractionSnapshot(snapshot, shotInProgress)
  if (!transition || !shotInProgress) return { transition: null, keepShotActive: extracting, acceptTelemetry: extracting }

  const state = snapshotState(snapshot)
  const withinTransitionWindow = now - transition.requestedAt <= SKIP_TRANSITION_TIMEOUT_MS
  if (!withinTransitionWindow || (state && DEFINITIVE_NON_ESPRESSO_STATES.has(state))) {
    return { transition: null, keepShotActive: extracting, acceptTelemetry: extracting }
  }

  if (state === 'skipstep') {
    return { transition: { ...transition, sawSkipState: true }, keepShotActive: true, acceptTelemetry: true }
  }

  const frame = typeof snapshot.profileFrame === 'number' && Number.isFinite(snapshot.profileFrame) ? snapshot.profileFrame : undefined
  const advancedFrame = transition.fromFrame !== undefined && frame !== undefined && frame !== transition.fromFrame
  const resumedWithoutFrames = transition.fromFrame === undefined && transition.sawSkipState && extracting
  if (extracting && (advancedFrame || resumedWithoutFrames)) {
    return { transition: null, keepShotActive: true, acceptTelemetry: true }
  }

  if (extracting) return { transition, keepShotActive: true, acceptTelemetry: true }

  // DE1 firmware can briefly report idle/pouringDone while skipToNext is
  // moving between frames. Preserve the shot but do not graph that frame.
  return { transition, keepShotActive: true, acceptTelemetry: false }
}
