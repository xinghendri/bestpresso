import assert from 'node:assert/strict'
import test from 'node:test'
import { liveHotWaterMeasurement, liveScaleDisplayWeight, normalizedLiveScaleWeight, scaleConnectionIsActive, scaleWeightCanTare } from '../src/domain/brewing.ts'

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

test('keeps the scale connected while either Decaid source still reports it live', () => {
  assert.equal(scaleConnectionIsActive(false, true), true)
  assert.equal(scaleConnectionIsActive(true, false), true)
  assert.equal(scaleConnectionIsActive(false, false), false)
})

test('accepts finite scale readings and clamps post-tare negative jitter', () => {
  assert.equal(normalizedLiveScaleWeight(42.3), 42.3)
  assert.equal(normalizedLiveScaleWeight(-0.2), 0)
  assert.equal(normalizedLiveScaleWeight(Number.NaN), undefined)
  assert.equal(normalizedLiveScaleWeight('42.3'), undefined)
})

test('preserves negative scale readings for the home-screen display', () => {
  assert.equal(liveScaleDisplayWeight(42.3), 42.3)
  assert.equal(liveScaleDisplayWeight(-100.2), -100.2)
  assert.equal(liveScaleDisplayWeight(Number.NaN), undefined)
  assert.equal(liveScaleDisplayWeight('42.3'), undefined)
})

test('allows the home-screen tare control for a negative reading', () => {
  assert.equal(scaleWeightCanTare(-100.2), true)
  assert.equal(scaleWeightCanTare(-0.1), true)
  assert.equal(scaleWeightCanTare(0), false)
})
