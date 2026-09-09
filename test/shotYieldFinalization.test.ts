import assert from 'node:assert/strict'
import test from 'node:test'
import { observePostShotWeight, reconciledShotPoints, reconciledShotYield, type YieldFinalizationState } from '../src/features/history/shotYieldFinalization.ts'

const initial = (weight = 34): YieldFinalizationState => ({ bestWeight: weight, lastWeight: weight, stableSamples: 0 })

test('keeps tracking pour-through after the machine stops extracting', () => {
  const result = observePostShotWeight(initial(), 35.2, 0.8)
  assert.equal(result.displayWeight, 35.2)
  assert.equal(result.finished, false)
})

test('locks the settled reading after ten low-flow samples', () => {
  let state = initial(35.8)
  let result = observePostShotWeight(state, 36, 0.1)
  for (let index = 1; index < 10; index += 1) {
    state = result.state
    result = observePostShotWeight(state, 36.1, 0.05)
  }
  assert.equal(result.displayWeight, 36.1)
  assert.equal(result.finished, true)
})

test('freezes the best reading when the cup is removed', () => {
  const result = observePostShotWeight(initial(36.2), 12, -4)
  assert.equal(result.displayWeight, 36.2)
  assert.equal(result.finished, true)
})

test('rejects a sudden positive flow spike after the shot', () => {
  const state = { ...initial(36.2), previousFlow: 0.1 }
  const result = observePostShotWeight(state, 36.8, 3.2)
  assert.equal(result.displayWeight, 36.2)
  assert.equal(result.finished, true)
})

test('uses settled scale telemetry instead of the persisted shot yield', () => {
  assert.equal(reconciledShotYield('34.8', 36.1), '36.1')
  assert.equal(reconciledShotYield('36.3', 36.1), '36.1')
})

test('keeps live scale points when Decaid persists machine-only shot measurements', () => {
  const persisted = [
    { elapsedMs: 0, stageIndex: 0, pressure: 1, flow: 4 },
    { elapsedMs: 1000, stageIndex: 0, pressure: 2, flow: 4 },
  ]
  const live = [
    { elapsedMs: 0, stageIndex: 0, pressure: 1, flow: 4, weight: 0, weightFlow: 0 },
    { elapsedMs: 1000, stageIndex: 0, pressure: 2, flow: 4, weight: 12.4, weightFlow: 1.2 },
  ]

  assert.deepEqual(reconciledShotPoints(persisted, live), live)
})

test('continues to prefer complete persisted measurements when they contain scale data', () => {
  const persisted = [{ elapsedMs: 0, pressure: 1, weight: 12.5 }]
  const live = [{ elapsedMs: 0, pressure: 1, weight: 12.4 }]

  assert.deepEqual(reconciledShotPoints(persisted, live), persisted)
})
