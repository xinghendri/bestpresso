import assert from 'node:assert/strict'
import test from 'node:test'
import { liveHotWaterMeasurement } from '../src/domain/brewing.ts'

test('uses scale weight for hot water when a scale is connected', () => {
  assert.deepEqual(liveHotWaterMeasurement({ scaleConnected: true, weightGrams: 42.3, volumeMl: 39.8, targetVolume: 50 }), {
    label: 'Weight',
    value: 42.3,
    target: 50,
    unit: 'g',
  })
})

test('falls back to integrated machine volume without a scale', () => {
  assert.deepEqual(liveHotWaterMeasurement({ scaleConnected: false, volumeMl: 39.8, targetVolume: 50 }), {
    label: 'Volume',
    value: 39.8,
    target: 50,
    unit: 'ml',
  })
})
