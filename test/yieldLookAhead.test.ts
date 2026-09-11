import assert from 'node:assert/strict'
import test from 'node:test'
import { hotWaterYieldLookAheadPatch } from '../src/features/settings/yieldLookAhead.ts'

test('hot water derives look-ahead from universal yield, including zero', () => {
  assert.deepEqual(hotWaterYieldLookAheadPatch({ weightFlowMultiplier: 0.7, hotWaterFlowMultiplier: 0.3 }), { hotWaterFlowMultiplier: 0.7 })
  assert.deepEqual(hotWaterYieldLookAheadPatch({ weightFlowMultiplier: 0, hotWaterFlowMultiplier: 0.3 }), { hotWaterFlowMultiplier: 0 })
  assert.deepEqual(hotWaterYieldLookAheadPatch({ weightFlowMultiplier: 0.7, hotWaterFlowMultiplier: 0.7 }), {})
  assert.deepEqual(hotWaterYieldLookAheadPatch({}), {})
  assert.deepEqual(hotWaterYieldLookAheadPatch({ weightFlowMultiplier: NaN }), {})
})
