interface SnapshotWithState {
  state?: string | { state?: string; substate?: string }
}

const ESPRESSO_EXTRACTION_SUBSTATES = new Set(['preinfusion', 'pouring'])

export function isEspressoExtractionSnapshot(snapshot: SnapshotWithState, shotInProgress = false) {
  const state = (typeof snapshot.state === 'string' ? snapshot.state : snapshot.state?.state)?.toLowerCase()
  const substate = (typeof snapshot.state === 'object' ? snapshot.state?.substate : undefined)?.toLowerCase()
  if (state === 'skipstep') return shotInProgress
  if (state && state !== 'espresso') return false
  if (substate) return ESPRESSO_EXTRACTION_SUBSTATES.has(substate)
  return state === 'espresso'
}
