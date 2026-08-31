import assert from 'node:assert/strict'
import test from 'node:test'
import { SLEEP_DISPLAY_BRIGHTNESS, sleepMachineWithConfiguredScalePolicy, shouldRunBackgroundScaleScan } from '../src/features/brew/sleepControl.ts'

test('keeps the sleeping display faintly visible', () => {
  assert.equal(SLEEP_DISPLAY_BRIGHTNESS, 7)
})

function sleepApi() {
  const calls: string[] = []
  return {
    calls,
    api: {
      setMachineState: async () => {
        calls.push('machine sleeping')
      },
    },
  }
}

test('lets Decaid apply its configured scale policy when the machine sleeps', async () => {
  const { api, calls } = sleepApi()

  await sleepMachineWithConfiguredScalePolicy(api)

  assert.deepEqual(calls, ['machine sleeping'])
})

test('never starts a preferred-scale scan while the machine is sleeping', () => {
  assert.equal(shouldRunBackgroundScaleScan('preferred-scale', false, 'sleeping'), false)
  assert.equal(shouldRunBackgroundScaleScan('preferred-scale', false, 'ready'), true)
  assert.equal(shouldRunBackgroundScaleScan(null, false, 'ready'), false)
  assert.equal(shouldRunBackgroundScaleScan('preferred-scale', true, 'ready'), false)
})
