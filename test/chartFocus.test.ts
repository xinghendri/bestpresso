import assert from 'node:assert/strict'
import test from 'node:test'
import { chartFocusLayerOpacity, focusedChartTransform, focusedChartX, interpolateChartFocusTransform, stageFocusedChartView } from '../src/features/brew/chartFocus.ts'

const points = [
  { elapsedMs: 0, pressure: 0 },
  { elapsedMs: 10_000, pressure: 2 },
  { elapsedMs: 20_000, pressure: 8 },
  { elapsedMs: 40_000, pressure: 0 },
]

test('uses the selected stage while retaining the complete shot as context', () => {
  const stagePoints = points.slice(1, 3)
  const view = stageFocusedChartView(points, 40_000, {
    startedAt: 10_000,
    endedAt: 20_000,
    points: stagePoints,
  })

  assert.equal(view.points, stagePoints)
  assert.equal(view.contextPoints, points)
  assert.equal(view.startMs, 10_000)
  assert.equal(view.elapsedMs, 10_000)
})

test('keeps the full shot view when no stage is selected', () => {
  const view = stageFocusedChartView(points, 40_000, null)

  assert.equal(view.points, points)
  assert.equal(view.contextPoints, undefined)
  assert.equal(view.startMs, 0)
  assert.equal(view.elapsedMs, 40_000)
})

test('draws the complete focused graph at twice the plot width around the stage center', () => {
  const geometry = {
    contextStartMs: 0,
    contextEndMs: 40_000,
    focusStartMs: 10_000,
    focusEndMs: 20_000,
    plotLeft: 42,
    plotWidth: 936,
  }

  const left = focusedChartX(0, geometry)
  const right = focusedChartX(40_000, geometry)
  const focusedCenter = focusedChartX(15_000, geometry)

  assert.equal(right - left, geometry.plotWidth * 2)
  assert.equal(focusedCenter, geometry.plotLeft + geometry.plotWidth / 2)
})

test('interpolates the chart geometry while expanding and contracting focus', () => {
  const focused = focusedChartTransform({
    contextStartMs: 0,
    contextEndMs: 40_000,
    focusStartMs: 10_000,
    focusEndMs: 20_000,
    plotLeft: 42,
    plotWidth: 936,
  })
  const normal = { scaleX: 1, translateX: 0 }

  assert.deepEqual(interpolateChartFocusTransform(normal, focused, 0), normal)
  assert.deepEqual(interpolateChartFocusTransform(normal, focused, 1), focused)
  assert.deepEqual(interpolateChartFocusTransform(normal, focused, 0.5), {
    scaleX: 1.5,
    translateX: focused.translateX / 2,
  })
  assert.deepEqual(interpolateChartFocusTransform(focused, normal, 1), normal)
})

test('crossfades the complete shot and selected stage with zoom progress', () => {
  assert.deepEqual(chartFocusLayerOpacity(1), { contextOpacity: 1, focusOpacity: 0 })
  assert.deepEqual(chartFocusLayerOpacity(1.5), { contextOpacity: 0.575, focusOpacity: 0.5 })
  assert.deepEqual(chartFocusLayerOpacity(2), { contextOpacity: 0.15000000000000002, focusOpacity: 1 })
})
