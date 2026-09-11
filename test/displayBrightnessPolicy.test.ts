import assert from 'node:assert/strict'
import test from 'node:test'
import { createDisplayBrightnessPolicy } from '../src/features/settings/displayBrightnessPolicy.ts'

function fixture(initial = 45, saved: number | null = null) {
  let current = initial
  const writes: number[] = []
  const policy = createDisplayBrightnessPolicy({
    read: async () => ({ requestedBrightness: current, brightness: Math.min(current, 20) }),
    write: async (value) => { current = value; writes.push(value) },
    load: () => saved,
    persist: (value) => { saved = value },
  })
  return { policy, writes, saved: () => saved }
}

test('disconnect and duplicate wake do not reset an undimmed display', async () => {
  const { policy, writes } = fixture()
  await policy.restore()
  await policy.restore()
  assert.deepEqual(writes, [])
})
test('rapid sleep/wake is ordered and preserves the requested brightness despite battery cap', async () => {
  const { policy, writes, saved } = fixture()
  await Promise.all([policy.dim(5), policy.restore(), policy.restore()])
  assert.deepEqual(writes, [5, 45])
  assert.equal(saved(), null)
})
test('explicit choices persist and are restored after sleep, including zero', async () => {
  const { policy, writes, saved } = fixture()
  await policy.choose(0)
  await policy.dim(5)
  await policy.restore()
  assert.deepEqual(writes, [0, 5, 0])
  assert.equal(saved(), 0)
})
test('boot replays a saved choice but does not rewrite matching state or an active sleep override', async () => {
  const { policy, writes } = fixture(100, 40)
  await policy.replay()
  await policy.replay()
  await policy.dim(5)
  await policy.replay()
  assert.deepEqual(writes, [40, 5])
})
test('saving during a sleep override updates the value used on wake', async () => {
  const { policy, writes } = fixture()
  await policy.dim(5)
  await policy.choose(60)
  await policy.restore()
  assert.deepEqual(writes, [5, 60, 60])
})
test('failed brightness writes are not persisted and do not poison the queue', async () => {
  let saved: number | null = null
  let fail = true
  const policy = createDisplayBrightnessPolicy({
    read: async () => ({ requestedBrightness: 50 }),
    write: async () => { if (fail) throw new Error('offline') },
    load: () => saved,
    persist: (value) => { saved = value },
  })
  await assert.rejects(policy.choose(30), /offline/)
  assert.equal(saved, null)
  fail = false
  await policy.choose(35)
  assert.equal(saved, 35)
})
