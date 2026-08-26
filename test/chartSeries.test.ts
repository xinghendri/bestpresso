import assert from 'node:assert/strict'
import test from 'node:test'
import { chartSeriesForLine, toggleDimmedChartSeries } from '../src/features/brew/chartSeries.ts'

test('groups flow and pressure targets with their live series', () => {
  assert.equal(chartSeriesForLine.flow, chartSeriesForLine.targetFlow)
  assert.equal(chartSeriesForLine.pressure, chartSeriesForLine.targetPressure)
})

test('toggles a dimmed chart series without disturbing the other filters', () => {
  assert.deepEqual(toggleDimmedChartSeries(['temperature'], 'flow'), ['temperature', 'flow'])
  assert.deepEqual(toggleDimmedChartSeries(['temperature', 'flow'], 'flow'), ['temperature'])
})
