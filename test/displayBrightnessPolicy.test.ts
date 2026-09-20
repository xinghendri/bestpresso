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

test('screensaver brightness is not capped to the default and wake restores normal brightness', async () => {
  const { policy, writes } = fixture(60)
  for (const value of [0, 3, 45, 100]) {
    await policy.dim(value)
    await policy.restore()
  }
  assert.deepEqual(writes, [0, 60, 3, 60, 45, 60, 100, 60])
})
test('wake uses the saved screen setting instead of a temporary Decaid snapshot', async () => {
  for (const snapshot of [7, 20, 100]) {
    const { policy, writes, saved } = fixture(snapshot, 45)
    await policy.dim(7)
    await policy.restore()
    assert.deepEqual(writes, [7, 45])
    assert.equal(saved(), 45)
  }
})
test('reloading while dimmed preserves normal brightness across repeated sleep cycles', async () => {
  const { policy, writes } = fixture(7, 60)
  await policy.dim(7)
  await policy.restore()
  await policy.dim(12)
  await policy.restore()
  assert.deepEqual(writes, [7, 60, 12, 60])
})
test('a saved zero or OS-managed value wins over the snapshot on wake', async () => {
  for (const saved of [0, 100]) {
    const { policy, writes } = fixture(7, saved)
    await policy.dim(12)
    await policy.restore()
    assert.deepEqual(writes, [12, saved])
  }
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
test('deepen darkens an active saver session and restore still returns the pre-sleep level', async () => {
  const { policy, writes } = fixture(60)
  await policy.dim(7)
  await policy.deepen(0)
  await policy.restore()
  assert.deepEqual(writes, [7, 0, 60])
})
test('deepen without an active dim session writes nothing and cannot fight a wake', async () => {
  const { policy, writes } = fixture(60)
  await policy.deepen(0)
  await policy.dim(7)
  await policy.restore()
  await policy.deepen(0)
  assert.deepEqual(writes, [7, 60])
})
test('deepen keeps the saver level out of the restore value after explicit choices', async () => {
  const { policy, writes, saved } = fixture(45)
  await policy.choose(30)
  await policy.dim(7)
  await policy.deepen(0)
  await policy.restore()
  assert.deepEqual(writes, [30, 7, 0, 30])
  assert.equal(saved(), 30)
})
