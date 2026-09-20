import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { shotToDomain } from '../src/api/decaid/adapters.ts'
import { inspectShotTelemetry } from '../src/features/brew/chartInspection.ts'
import { smoothShotTelemetry } from '../src/features/brew/chartSmoothing.ts'
import { chartSeriesForLine, toggleDimmedChartSeries } from '../src/features/brew/chartSeries.ts'
import { languageRegistry } from '../src/i18n/registry.ts'

test('saved shots retain scale yield flow separately from cumulative yield', () => {
  const shot = shotToDomain({ id: 'flow', timestamp: '2026-09-20T00:00:00Z', measurements: [
    { machine: { timestamp: '2026-09-20T00:00:00Z' }, scale: { weight: 20, weightFlow: 1.2 } },
    { machine: { timestamp: '2026-09-20T00:00:01Z' }, scale: { weight: 22, weightFlow: 2.4 } },
    { machine: { timestamp: '2026-09-20T00:00:02Z' }, scale: { weight: 24 } },
  ] })
  assert.deepEqual(shot.points?.map(p => p.weightFlow), [1.2, 2.4, undefined])
  assert.deepEqual(shot.points?.map(p => p.weight), [20, 22, 24])
  assert.equal(shot.totalYield, '24')
})

test('yield-flow inspection interpolates available data without bridging missing samples', () => {
  const points = [{ elapsedMs: 0, weight: 20, weightFlow: 1 }, { elapsedMs: 1000, weight: 22, weightFlow: 3 }]
  assert.equal(inspectShotTelemetry(points, 500)?.weightFlow, 2)
  assert.equal(inspectShotTelemetry(points, 500)?.weight, 21)
  assert.deepEqual(smoothShotTelemetry(points).map(p => p.weightFlow), [1, 3])
  for (const weightFlow of [undefined, NaN, Infinity]) {
    assert.equal(inspectShotTelemetry([points[0], { elapsedMs: 1000, weight: 22, weightFlow }], 500)?.weightFlow, undefined)
  }
})

test('both chart layers and tooltip use g/s, never the old target-weight scaling', () => {
  const source = readFileSync(new URL('../src/features/brew/LiveShotChart.tsx', import.meta.url), 'utf8')
  for (const points of ['plottedPoints', 'focusPoints']) assert.ok(source.includes(`linePath(${points}, 'weightFlow', xForElapsedMs, 0, 12)`))
  assert.doesNotMatch(source, /weightMax|targetYield|linePath\([^\n]*'weight',/)
  assert.match(source, /reading\(inspection.weightFlow, 1\)\}<small>g\/s/)
  assert.match(source, /bar \/ ml\/s \/ g\/s/)
  assert.equal(chartSeriesForLine.weightFlow, 'weight')
  assert.deepEqual(toggleDimmedChartSeries(['flow'], chartSeriesForLine.weightFlow), ['flow', 'weight'])
})

test('yield-flow label and chart descriptions are translated in every supported locale', async () => {
  for (const [language, entry] of Object.entries(languageRegistry)) {
    const catalog = await entry.load()
    assert.ok(catalog['brew.metric.yieldFlow'], language)
    assert.ok(catalog['brew.chart.live.ariaLabelWithWeight'], language)
    assert.ok(catalog['insights.miniChart.ariaLabelWeight'], language)
  }
})
