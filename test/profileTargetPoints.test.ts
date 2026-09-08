import assert from 'node:assert/strict'
import test from 'node:test'
import { profileStepsToTargetPoints } from '../src/api/decaid/profileTargetPoints.ts'

test('profile target points reflect the controlled axis, active limiter, and temperature', () => {
  const points = profileStepsToTargetPoints([
    {
      name: 'Fill', pump: 'flow', transition: 'fast', flow: 11, pressure: 1,
      temperature: 105, seconds: 20, limiter: { value: 0, range: 0.6 },
    },
    {
      name: 'Infuse', pump: 'pressure', transition: 'fast', pressure: 0.1, flow: 4,
      temperature: 105, seconds: 60, limiter: { value: 0, range: 0.6 },
    },
    {
      name: 'Limited flush', pump: 'flow', transition: 'fast', flow: 8,
      temperature: 40, seconds: 12, limiter: { value: 6, range: 0.6 },
    },
  ])

  assert.deepEqual(points, [
    { elapsedMs: 0, pressure: 0, flow: 0, temperature: 105 },
    { elapsedMs: 0, pressure: 0, flow: 11, temperature: 105 },
    { elapsedMs: 20_000, pressure: 0, flow: 11, temperature: 105 },
    { elapsedMs: 20_000, pressure: 0, flow: 11, temperature: 105 },
    { elapsedMs: 20_000, pressure: 0.1, flow: 0, temperature: 105 },
    { elapsedMs: 80_000, pressure: 0.1, flow: 0, temperature: 105 },
    { elapsedMs: 80_000, pressure: 0.1, flow: 0, temperature: 105 },
    { elapsedMs: 80_000, pressure: 6, flow: 8, temperature: 40 },
    { elapsedMs: 92_000, pressure: 6, flow: 8, temperature: 40 },
  ])
})

test('profile target points accept Decaid legacy numeric strings', () => {
  const points = profileStepsToTargetPoints([
    { pump: 'flow', transition: 'fast', flow: '3.5' as unknown as number, temperature: '92' as unknown as number, seconds: '10' as unknown as number },
  ])

  assert.deepEqual(points.at(-1), { elapsedMs: 10_000, pressure: 0, flow: 3.5, temperature: 92 })
})
