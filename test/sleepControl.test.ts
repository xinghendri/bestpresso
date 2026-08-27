import assert from 'node:assert/strict'
import test from 'node:test'
import type { DecaidSettings, ScalePowerMode } from '../src/api/decaid/types.ts'
import { sleepMachineAndConnectedScale } from '../src/features/brew/sleepControl.ts'

function sleepApi(settings: DecaidSettings = {}) {
  const calls: string[] = []
  return {
    calls,
    api: {
      getSettings: async () => {
        calls.push('get settings')
        return settings
      },
      setScalePowerMode: async (mode: ScalePowerMode) => {
        calls.push(`scale ${mode}`)
      },
      setMachineState: async () => {
        calls.push('machine sleeping')
      },
    },
  }
}

test('sleeps the machine directly when no scale is connected', async () => {
  const { api, calls } = sleepApi()

  await sleepMachineAndConnectedScale(false, api)

  assert.deepEqual(calls, ['machine sleeping'])
})

for (const scalePowerMode of [undefined, 'disabled', 'disconnect'] as const) {
  test(`enables display-off power management when the current mode is ${scalePowerMode ?? 'missing'}`, async () => {
    const { api, calls } = sleepApi({ scalePowerMode })

    await sleepMachineAndConnectedScale(true, api)

    assert.deepEqual(calls, ['get settings', 'scale displayOff', 'machine sleeping'])
  })
}

test('avoids rewriting an existing display-off preference', async () => {
  const { api, calls } = sleepApi({ scalePowerMode: 'displayOff' })

  await sleepMachineAndConnectedScale(true, api)

  assert.deepEqual(calls, ['get settings', 'machine sleeping'])
})

test('does not sleep the machine when connected-scale preparation fails', async () => {
  const { api, calls } = sleepApi({ scalePowerMode: 'disabled' })
  api.setScalePowerMode = async () => {
    calls.push('scale displayOff failed')
    throw new Error('failed')
  }

  await assert.rejects(sleepMachineAndConnectedScale(true, api), /failed/)
  assert.deepEqual(calls, ['get settings', 'scale displayOff failed'])
})
