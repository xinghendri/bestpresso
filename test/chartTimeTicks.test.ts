import assert from 'node:assert/strict'
import test from 'node:test'
import { removeOverlappingFocusedTimeTicks } from '../src/features/brew/chartTimeTicks.ts'

test('keeps the final focused-stage second marker when its predecessor overlaps', () => {
  const ticks = removeOverlappingFocusedTimeTicks([
    { offsetMs: 0, x: 42, label: '20s' },
    { offsetMs: 5_000, x: 300, label: '25s' },
    { offsetMs: 5_300, x: 308, label: '25.3s' },
  ])

  assert.deepEqual(ticks.map((tick) => tick.label), ['20s', '25.3s'])
})

test('only removes labels whose rendered ranges overlap', () => {
  const ticks = removeOverlappingFocusedTimeTicks([
    { offsetMs: 0, x: 42, label: '20s' },
    { offsetMs: 5_000, x: 260, label: '25s' },
    { offsetMs: 10_000, x: 478, label: '30s' },
  ])

  assert.deepEqual(ticks.map((tick) => tick.label), ['20s', '25s', '30s'])
})

test('uses the last marker when a very short focus range cannot show both boundaries', () => {
  const ticks = removeOverlappingFocusedTimeTicks([
    { offsetMs: 0, x: 300, label: '25s' },
    { offsetMs: 400, x: 309, label: '25.4s' },
  ])

  assert.deepEqual(ticks.map((tick) => tick.label), ['25.4s'])
})
