import assert from 'node:assert/strict'
import test from 'node:test'
import { createHotWaterSync, hotWaterFromShotSettings, hotWaterTargetTemperature } from '../src/features/brew/hotWaterSync.ts'
import type { DecaidWorkflowPatch } from '../src/api/decaid/types.ts'

function fixture() {
  let time = 0
  const values = new Map<string, unknown>()
  const calls: unknown[] = []
  const api = {
    read: async (key: string) => { calls.push(['read', key]); return values.get(key) },
    store: async (key: string, value: number) => { calls.push(['store', key, value]); values.set(key, value) },
    update: async (patch: DecaidWorkflowPatch) => { calls.push(['workflow', patch]); return patch },
    now: () => time,
  }
  return { api, calls, values, advance: () => { time += 30_001 } }
}
const idle = () => true
const old = { hotWaterData: { volume: 20, targetTemperature: 60 } }

test('display target prefers machine readback, falls back to workflow, and never invents a temperature', () => {
  assert.equal(hotWaterTargetTemperature({ targetTemperature: 80 }, old), 80)
  assert.equal(hotWaterTargetTemperature({}, old), 60)
  assert.equal(hotWaterTargetTemperature({}, {}), undefined)
  assert.equal(hotWaterTargetTemperature({ targetTemperature: NaN }, old), 60)
  assert.equal(hotWaterTargetTemperature({}, { hotWaterData: { targetTemperature: Infinity } }), undefined)
})

test('saves shared intent before workflow for both edited targets, preserving safety settings', async () => {
  const f = fixture()
  const sync = createHotWaterSync(f.api)
  await sync.save({ hotWaterData: { volume: 25, targetTemperature: 70, duration: 30, flow: 7 } })
  assert.deepEqual(f.calls, [
    ['store', 'last-hot-water-volume', 25],
    ['store', 'last-hot-water-temp', 70],
    ['workflow', { hotWaterData: { volume: 25, targetTemperature: 70, duration: 30, flow: 7 } }],
  ])
})

test('editing flow or duration never republishes unchanged shared targets', async () => {
  const f = fixture()
  await createHotWaterSync(f.api).save({ hotWaterData: { flow: 4 } })
  assert.deepEqual(f.calls, [['workflow', { hotWaterData: { flow: 4 } }]])
})

test('shared persistence failure prevents workflow writes, with subsequent retry possible', async () => {
  const f = fixture()
  let fail = true
  const sync = createHotWaterSync({ ...f.api, store: async (key, value) => {
    if (fail) throw new Error('store offline')
    return f.api.store(key, value)
  } })
  await assert.rejects(sync.save({ hotWaterData: { volume: 25 } }), /store offline/)
  assert.deepEqual(f.calls, [])
  fail = false
  await sync.save({ hotWaterData: { volume: 25 } })
  assert.equal(f.calls.length, 2)
})

test('workflow failure is surfaced without losing remembered intent', async () => {
  const f = fixture()
  const sync = createHotWaterSync({ ...f.api, update: async () => { throw new Error('BLE write failed') } })
  await assert.rejects(sync.save({ hotWaterData: { volume: 25 } }), /BLE/)
  assert.equal(f.values.get('last-hot-water-volume'), 25)
})

test('boot restores only differing known targets, never invented defaults or caps', async () => {
  const f = fixture()
  f.values.set('last-hot-water-volume', 25)
  const sync = createHotWaterSync(f.api)
  await sync.reconcile(old, idle)
  assert.deepEqual(f.calls.at(-1), ['workflow', { hotWaterData: { volume: 25 } }])
  const count = f.calls.length
  await sync.reconcile(old, idle)
  assert.equal(f.calls.length, count)
})

test('missing workflow target is restored; absent/invalid intent is never pushed', async () => {
  for (const value of [null, undefined, '', '25', NaN, Infinity, -1]) {
    const f = fixture()
    f.values.set('last-hot-water-volume', value)
    await createHotWaterSync(f.api).reconcile({}, idle)
    assert.equal(f.calls.filter((c) => (c as unknown[])[0] === 'workflow').length, 0)
  }
  const f = fixture()
  f.values.set('last-hot-water-volume', 0)
  await createHotWaterSync(f.api).reconcile({}, idle)
  assert.deepEqual(f.calls.at(-1), ['workflow', { hotWaterData: { volume: 0 } }])
})

test('live physical readback takes precedence over workflow, without altering duration/flow', async () => {
  const f = fixture()
  f.values.set('last-hot-water-volume', 25)
  const sync = createHotWaterSync(f.api)
  sync.observe({ targetHotWaterVolume: 14, targetHotWaterTemp: 65, targetHotWaterDuration: 30 })
  await sync.reconcile({ hotWaterData: { volume: 25 } }, idle)
  assert.deepEqual(f.calls.at(-1), ['workflow', { hotWaterData: { volume: 25 } }])
  // A successful HTTP response is not a physical echo.
  assert.equal(sync.readback().volume, 14)
  sync.observe({ targetHotWaterVolume: 25 })
  assert.deepEqual(sync.readback(), { volume: 25, targetTemperature: 65, duration: 30 })
  sync.disconnect()
  assert.deepEqual(sync.readback(), {})
})

test('alternating old/new physical echoes cannot create a write storm', async () => {
  const f = fixture()
  f.values.set('last-hot-water-volume', 25)
  const sync = createHotWaterSync(f.api)
  for (let i = 0; i < 100; i++) {
    sync.observe({ targetHotWaterVolume: i % 2 ? 25 : 20 })
    await sync.reconcile(old, idle)
  }
  assert.equal(f.calls.filter((c) => (c as unknown[])[0] === 'workflow').length, 1)
  f.advance()
  sync.observe({ targetHotWaterVolume: 19 })
  await sync.reconcile(old, idle)
  assert.equal(f.calls.filter((c) => (c as unknown[])[0] === 'workflow').length, 2)
})

test('no automatic requests while dispensing/unknown/disconnected; deferred drift repairs when idle', async () => {
  const f = fixture()
  f.values.set('last-hot-water-volume', 25)
  const sync = createHotWaterSync(f.api)
  await sync.reconcile(old, () => false)
  assert.deepEqual(f.calls, [])
  await sync.reconcile(old, idle)
  assert.deepEqual(f.calls.at(-1), ['workflow', { hotWaterData: { volume: 25 } }])
})

test('machine becoming active during shared lookup cancels automatic write', async () => {
  const f = fixture()
  f.values.set('last-hot-water-volume', 25)
  let safe = true
  const sync = createHotWaterSync({ ...f.api, read: async (key) => {
    const value = await f.api.read(key)
    safe = false
    return value
  } })
  await sync.reconcile(old, () => safe)
  assert.equal(f.calls.filter((c) => (c as unknown[])[0] === 'workflow').length, 0)
})

test('an explicit edit supersedes an in-flight drift lookup and cannot be undone by its echo', async () => {
  const f = fixture()
  let finish!: (value: unknown) => void
  const sync = createHotWaterSync({ ...f.api, read: () => new Promise((resolve) => { finish = resolve }) })
  const correction = sync.reconcile(old, idle)
  await Promise.resolve()
  const edit = sync.save({ hotWaterData: { volume: 30 } })
  finish(25)
  await Promise.all([correction, edit])
  assert.deepEqual(f.calls, [
    ['store', 'last-hot-water-volume', 30],
    ['workflow', { hotWaterData: { volume: 30 } }],
  ])
})

test('malformed readback cannot turn missing values into zero', () => {
  assert.deepEqual(hotWaterFromShotSettings({ targetHotWaterVolume: NaN, targetHotWaterTemp: -1 }), {})
  assert.deepEqual(hotWaterFromShotSettings({ targetHotWaterVolume: 0 }), { volume: 0 })
})

test('failed drift write retries only after cooldown and repeated frames do not repaint', async () => {
  const f = fixture()
  f.values.set('last-hot-water-volume', 25)
  let attempts = 0
  const sync = createHotWaterSync({ ...f.api, update: async (patch) => {
    attempts++
    if (attempts === 1) throw new Error('BLE offline')
    return f.api.update(patch)
  } })
  assert.equal(sync.observe({ targetHotWaterVolume: 20 }), true)
  assert.equal(sync.observe({ targetHotWaterVolume: 20 }), false)
  await assert.rejects(sync.reconcile(old, idle), /BLE offline/)
  await sync.reconcile(old, idle)
  assert.equal(attempts, 1)
  f.advance()
  await sync.reconcile(old, idle)
  assert.equal(attempts, 2)
})
