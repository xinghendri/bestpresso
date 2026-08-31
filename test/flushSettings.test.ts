import assert from 'node:assert/strict'
import test from 'node:test'
import { rinseWorkflowPatchFromMachineSettings } from '../src/features/brew/flushSettings.ts'

test('persists the live machine flush settings over a stale workflow value', () => {
  assert.deepEqual(rinseWorkflowPatchFromMachineSettings(
    { rinseData: { targetTemperature: 92, duration: 5, flow: 6 } },
    { flushTemp: 92, flushTimeout: 7, flushFlow: 6 },
  ), {
    rinseData: { targetTemperature: 92, duration: 7, flow: 6 },
  })
})

test('does not write the workflow when live machine and workflow settings agree', () => {
  assert.equal(rinseWorkflowPatchFromMachineSettings(
    { rinseData: { targetTemperature: 92, duration: 7, flow: 6 } },
    { flushTemp: 92, flushTimeout: 7, flushFlow: 6 },
  ), null)
})

test('preserves workflow fields that are missing from the machine response', () => {
  assert.deepEqual(rinseWorkflowPatchFromMachineSettings(
    { rinseData: { targetTemperature: 92, duration: 5, flow: 6 } },
    { flushTimeout: 7 },
  ), {
    rinseData: { targetTemperature: 92, duration: 7, flow: 6 },
  })
})

test('ignores unusable machine values instead of corrupting the workflow', () => {
  assert.equal(rinseWorkflowPatchFromMachineSettings(
    { rinseData: { targetTemperature: 92, duration: 7, flow: 6 } },
    { flushTemp: Number.NaN, flushTimeout: -1, flushFlow: Number.POSITIVE_INFINITY },
  ), null)
})
