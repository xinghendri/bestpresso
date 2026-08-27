import assert from 'node:assert/strict'
import test from 'node:test'
import type { LiveShotPoint } from '../src/domain/brewing.ts'
import { smoothShotTelemetry } from '../src/features/brew/chartSmoothing.ts'

const uniformTimeConstants = { pressure: 100, flow: 100, temperature: 100 }

test('smooths actual telemetry without changing targets, weight, or source points', () => {
  const points: LiveShotPoint[] = [
    { elapsedMs: 0, pressure: 0, flow: 0, temperature: 90, targetPressure: 9, targetFlow: 2, weight: 0 },
    { elapsedMs: 100, pressure: 10, flow: 6, temperature: 94, targetPressure: 9, targetFlow: 2, weight: 4 },
  ]

  const smoothed = smoothShotTelemetry(points, uniformTimeConstants)
  const alpha = 1 - Math.exp(-1)

  assert.notEqual(smoothed[1], points[1])
  assert.equal(points[1].pressure, 10)
  assert.ok(Math.abs(smoothed[1].pressure! - 10 * alpha) < 0.000_001)
  assert.ok(Math.abs(smoothed[1].flow! - 6 * alpha) < 0.000_001)
  assert.ok(Math.abs(smoothed[1].temperature! - (90 + 4 * alpha)) < 0.000_001)
  assert.equal(smoothed[1].targetPressure, 9)
  assert.equal(smoothed[1].targetFlow, 2)
  assert.equal(smoothed[1].weight, 4)
})

test('uses elapsed time so the result is stable across different sample cadences', () => {
  const dense = smoothShotTelemetry([
    { elapsedMs: 0, pressure: 0 },
    { elapsedMs: 100, pressure: 10 },
    { elapsedMs: 200, pressure: 10 },
  ], uniformTimeConstants)
  const sparse = smoothShotTelemetry([
    { elapsedMs: 0, pressure: 0 },
    { elapsedMs: 200, pressure: 10 },
  ], uniformTimeConstants)

  assert.ok(Math.abs(dense.at(-1)!.pressure! - sparse.at(-1)!.pressure!) < 0.000_001)
})

test('restarts a series after missing data instead of blending across the gap', () => {
  const smoothed = smoothShotTelemetry([
    { elapsedMs: 0, pressure: 2 },
    { elapsedMs: 100 },
    { elapsedMs: 200, pressure: 8 },
  ], uniformTimeConstants)

  assert.equal(smoothed[2].pressure, 8)
})
