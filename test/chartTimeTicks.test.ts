import assert from 'node:assert/strict'
import test from 'node:test'
import { removeOverlappingFocusedTimeTicks, shouldShowTimelineLabel } from '../src/features/brew/chartTimeTicks.ts'

test('keeps five-second labels through a 90-second shot', () => {
  assert.equal(shouldShowTimelineLabel(85_000, 0, 90_000), true)
})

test('shows only every third five-second label after a shot exceeds 90 seconds', () => {
  const offsets = Array.from({ length: 21 }, (_, index) => (index + 1) * 5_000)
  const labels = offsets.filter((offsetMs) => shouldShowTimelineLabel(offsetMs, 0, 105_000))

  assert.deepEqual(labels, [15_000, 30_000, 45_000, 60_000, 75_000, 90_000, 105_000])
})

test('keeps focused timeline boundaries even on a long shot', () => {
  assert.equal(shouldShowTimelineLabel(0, 20_000, 100_000, true), true)
  assert.equal(shouldShowTimelineLabel(100_000, 20_000, 100_000, true), true)
})

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
