import type { LiveShotPoint } from '../../domain/brewing.ts'

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
  return settledWeight.toFixed(1)
}

export function reconciledShotPoints(persistedPoints: LiveShotPoint[] | undefined, livePoints: LiveShotPoint[]) {
  if (!persistedPoints?.length) return livePoints
  if (!livePoints.some((point) => Number.isFinite(point.weight))) return persistedPoints

  let liveIndex = 0
  return persistedPoints.map((point) => {
    while (
      liveIndex + 1 < livePoints.length
      && Math.abs(livePoints[liveIndex + 1].elapsedMs - point.elapsedMs) <= Math.abs(livePoints[liveIndex].elapsedMs - point.elapsedMs)
    ) liveIndex += 1
    const livePoint = livePoints[liveIndex]
    const weight = point.weight ?? livePoint?.weight
    const weightFlow = point.weightFlow ?? livePoint?.weightFlow
    return {
      ...point,
      ...(weight === undefined ? {} : { weight }),
      ...(weightFlow === undefined ? {} : { weightFlow }),
    }
  })
}
