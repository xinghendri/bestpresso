import assert from 'node:assert/strict'
import test from 'node:test'
import { utilityElapsedMs, utilityOutputHasStarted, utilityTimerStartedAt } from '../src/features/brew/utilityOperationTiming.ts'

test('steam timer waits at zero until Decaid reports actual pouring', () => {
  const preparing = { state: 'steam', substate: 'preparingForShot' }
  const pouring = { state: 'steam', substate: 'pouring' }

  let startedAt = utilityTimerStartedAt('steam', undefined, preparing, 10_000)
  assert.equal(startedAt, undefined)
  assert.equal(utilityElapsedMs(startedAt, 12_000), 0)

  startedAt = utilityTimerStartedAt('steam', startedAt, pouring, 12_000)
  assert.equal(startedAt, 12_000)
  assert.equal(utilityElapsedMs(startedAt, 31_000), 19_000)
})

test('steam timer keeps its first pouring timestamp', () => {
  const pouring = { state: 'steam', substate: 'pouring' }
  assert.equal(utilityTimerStartedAt('steam', 12_000, pouring, 13_000), 12_000)
})

test('hot water and flush timers also wait for actual pouring', () => {
  for (const kind of ['hotWater', 'flush'] as const) {
    const preparing = { state: kind, substate: 'preparingForShot' }
    const pouring = { state: kind, substate: 'pouring' }

    assert.equal(utilityTimerStartedAt(kind, undefined, preparing, 5_000), undefined)
    assert.equal(utilityTimerStartedAt(kind, undefined, pouring, 7_000), 7_000)
  }
})

test('legacy snapshots without a substate retain immediate utility timing', () => {
  for (const kind of ['steam', 'hotWater', 'flush'] as const) {
    assert.equal(utilityOutputHasStarted(kind, kind), true)
    assert.equal(utilityTimerStartedAt(kind, undefined, kind, 5_000), 5_000)
  }
})
