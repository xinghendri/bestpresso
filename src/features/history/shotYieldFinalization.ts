export const FINAL_YIELD_SETTLE_FLOW = 0.4
export const FINAL_YIELD_SETTLE_SAMPLES = 10
export const FINAL_YIELD_REMOVAL_FLOW = -3
export const FINAL_YIELD_FLOW_SPIKE = 3

export interface YieldFinalizationState {
  bestWeight: number
  lastWeight: number
  stableSamples: number
  previousFlow?: number
}

export interface YieldFinalizationResult {
  state: YieldFinalizationState
  displayWeight: number
  finished: boolean
}

export function observePostShotWeight(state: YieldFinalizationState, weight: number, weightFlow?: number): YieldFinalizationResult {
  if (!Number.isFinite(weight) || weight <= 0) return { state, displayWeight: state.bestWeight, finished: false }
  const flow = typeof weightFlow === 'number' && Number.isFinite(weightFlow) ? weightFlow : undefined
  const removal = flow !== undefined && flow < FINAL_YIELD_REMOVAL_FLOW
  const spike = flow !== undefined && state.previousFlow !== undefined && flow > state.previousFlow + FINAL_YIELD_FLOW_SPIKE
  if (removal || spike) return { state, displayWeight: state.bestWeight, finished: true }

  const stableSamples = flow !== undefined && Math.abs(flow) < FINAL_YIELD_SETTLE_FLOW ? state.stableSamples + 1 : 0
  const nextState = { bestWeight: Math.max(state.bestWeight, weight), lastWeight: weight, stableSamples, previousFlow: flow ?? state.previousFlow }
  const finished = stableSamples >= FINAL_YIELD_SETTLE_SAMPLES
  return { state: nextState, displayWeight: finished ? weight : nextState.bestWeight, finished }
}

export function reconciledShotYield(persistedYield: string, settledWeight?: number) {
  if (settledWeight === undefined || !Number.isFinite(settledWeight) || settledWeight <= 0) return persistedYield
  const persisted = Number(persistedYield)
  const yieldValue = Number.isFinite(persisted) && persisted > 0 ? Math.max(persisted, settledWeight) : settledWeight
  return yieldValue.toFixed(1)
}
