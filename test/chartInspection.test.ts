import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { inspectShotTelemetry } from '../src/features/brew/chartInspection.ts'

const chartSource = readFileSync(new URL('../src/features/brew/LiveShotChart.tsx', import.meta.url), 'utf8')
const styles = readFileSync(new URL('../src/styles/index.css', import.meta.url), 'utf8')

test('interpolates every telemetry reading at the held chart time', () => {
  const inspection = inspectShotTelemetry([
    { elapsedMs: 1_000, pressure: 2, flow: 1, temperature: 90, weight: 4 },
    { elapsedMs: 3_000, pressure: 8, flow: 3, temperature: 94, weight: 12 },
  ], 2_000)

  assert.deepEqual(inspection, {
    elapsedMs: 2_000,
    pressure: 5,
    flow: 2,
    temperature: 92,
    weight: 8,
  })
})

test('uses the available side of a missing telemetry interval', () => {
  const inspection = inspectShotTelemetry([
    { elapsedMs: 0, pressure: 1, temperature: 90 },
    { elapsedMs: 1_000, pressure: 3, flow: 2 },
  ], 500)

  assert.equal(inspection?.pressure, 2)
  assert.equal(inspection?.flow, 2)
  assert.equal(inspection?.temperature, 90)
})

test('keeps vertical graph guides hidden until a hold inspection', () => {
  assert.doesNotMatch(chartSource, /className="chart-grid chart-grid--vertical"/)
  assert.match(chartSource, /INSPECTION_HOLD_MS = 180/)
  assert.match(chartSource, /className="chart-inspection-cursor"/)
  assert.match(chartSource, />Pressure<\/dt>/)
  assert.match(chartSource, />Flow<\/dt>/)
  assert.match(chartSource, />Temperature<\/dt>/)
  assert.match(chartSource, />Yield<\/dt>/)
})

test('uses thinner detailed lines and subtle telemetry gradients', () => {
  assert.match(styles, /\.live-shot-chart \.chart-line \{ stroke-width:1\.5;/)
  assert.match(styles, /\.live-shot-chart \.chart-line--temperature \{ stroke-width:1\.25;/)
  assert.match(styles, /older shared chart geometry[\s\S]*\.live-shot-chart \.chart-line--target-flow \{ stroke-width:1\.5; \}/)
  assert.match(styles, /\.live-shot-chart \.chart-legend__sample \{ height:2px; \}/)
  assert.match(chartSource, /pressure-area/)
  assert.match(chartSource, /flow-area/)
  assert.match(chartSource, /temperature-area/)
  assert.match(styles, /\.chart-inspection-point \{ position:absolute; width:8px; height:8px;[^}]*border-radius:50%;/)
  assert.match(styles, /\.chart-inspection-point--pressure \{ background:var\(--chart-pressure\);/)
  assert.match(styles, /\.chart-inspection dl>div::before/)
})

test('uses medium metric typography and an eight pixel larger cursor gap', () => {
  assert.match(styles, /\.chart-inspection \{[^}]*width:min\(300px,calc\(100% - 40px\)\);[^}]*transform:translateX\(20px\);/)
  assert.match(styles, /\.chart-inspection--before \{ transform:translateX\(calc\(-100% - 20px\)\); \}/)
  assert.match(styles, /\.chart-inspection dt \{[^}]*font-size:var\(--metric-label-size-medium\);/)
  assert.match(styles, /\.chart-inspection dd \{[^}]*font-size:var\(--metric-value-size-medium\);/)
  assert.match(styles, /\.chart-inspection dd small \{[^}]*font-size:var\(--metric-unit-size-medium\);/)
  assert.match(styles, /\.chart-inspection>time \{[^}]*color:#e2e2e2;[^}]*font-size:var\(--metric-label-size-medium\);/)
})
