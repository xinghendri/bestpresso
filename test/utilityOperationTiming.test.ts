import assert from 'node:assert/strict'
import test from 'node:test'
import { createUtilityDismissal, utilityElapsedMs, utilityOutputHasStarted, utilityTimerStartedAt } from '../src/features/brew/utilityOperationTiming.ts'
import { readFileSync } from 'node:fs'

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

function dismissalClock() {
  let now = 0, count = 0, id = 0
  const tasks = new Map<number, { at: number; callback: () => void }>()
  const callbacks: Array<() => void> = []
  const dismissal = createUtilityDismissal((callback, delay) => {
    tasks.set(++id, { at: now + delay, callback }); callbacks.push(callback); return id
  }, timer => { tasks.delete(timer) }, () => { count += 1 })
  return { dismissal, callbacks, count: () => count, pending: () => tasks.size, advance: (ms: number) => {
    now += ms
    for (const [key, task] of tasks) if (task.at <= now) { tasks.delete(key); task.callback() }
  } }
}

test('utility completion remains visible for exactly 500 ms regardless of stop source', () => {
  for (const kind of ['hotWater', 'steam', 'flush']) for (const stop of ['manual', 'automatic']) {
    const clock = dismissalClock()
    clock.dismissal.finish()
    assert.equal(clock.count(), 0, `${kind} ${stop}`)
    clock.advance(499)
    assert.equal(clock.count(), 0)
    clock.advance(1)
    assert.equal(clock.count(), 1)
    assert.equal(clock.pending(), 0)
  }
})

test('repeated ended snapshots do not extend the dismissal grace period', () => {
  const clock = dismissalClock()
  clock.dismissal.finish()
  clock.advance(300)
  clock.dismissal.finish()
  clock.advance(200)
  assert.equal(clock.count(), 1)
})

test('new operations, disconnect and disposal cancel even an already-queued callback', () => {
  const clock = dismissalClock()
  clock.dismissal.finish()
  clock.advance(250)
  clock.dismissal.cancel()
  clock.callbacks[0]()
  clock.advance(1000)
  assert.equal(clock.count(), 0)
  assert.equal(clock.pending(), 0)
  clock.dismissal.finish()
  clock.callbacks[0]()
  assert.equal(clock.count(), 0)
  clock.advance(500)
  assert.equal(clock.count(), 1)
})

test('the hook delays only completion and clears the delay on replacement or disconnect', () => {
  const source = readFileSync(new URL('../src/features/brew/useBrewingData.ts', import.meta.url), 'utf8')
  assert.match(source, /if \(operationKind\) \{\s*utilityDismissal.cancel\(\)/)
  assert.match(source, /utilityOperationSession.current = null\s*utilityDismissal.finish\(\)/)
  assert.match(source, /if \(isEspressoMonitoring \|\| isCleaning\) \{\s*utilityDismissal.cancel\(\)\s*setUtilityOperation\(null\)/)
  assert.match(source, /completeLiveShot\(true\)\s*utilityOperationSession.current = null\s*utilityDismissal.cancel\(\)/)
  assert.match(source, /disposed = true\s*utilityDismissal.cancel\(\)/)
})
