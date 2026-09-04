import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const liveStages = readFileSync(new URL('../src/features/brew/LiveBrewStages.tsx', import.meta.url), 'utf8')
const liveChart = readFileSync(new URL('../src/features/brew/LiveShotChart.tsx', import.meta.url), 'utf8')
const history = readFileSync(new URL('../src/features/history/PreviousShotScreen.tsx', import.meta.url), 'utf8')
const builder = readFileSync(new URL('../src/features/profiles/ProfileBuilderScreen.tsx', import.meta.url), 'utf8')
const legend = readFileSync(new URL('../src/features/brew/ChartLegend.tsx', import.meta.url), 'utf8')
const markers = readFileSync(new URL('../src/features/brew/ChartStageMarkers.tsx', import.meta.url), 'utf8')
const styles = readFileSync(new URL('../src/styles/index.css', import.meta.url), 'utf8')

test('live monitoring and history share the same numbered stage presentation', () => {
  assert.match(liveStages, /live-brew-stage__heading/)
  assert.match(liveStages, /<b>\{index \+ 1\}<\/b>/)
  assert.doesNotMatch(liveStages, /String\(index \+ 1\)\.padStart/)
  assert.match(styles, /\.live-brew-stage header \{[^}]*border-bottom:/)

  assert.match(liveChart, /<ChartStageMarkers/)
  assert.match(liveChart, /<ChartLegend/)
  assert.match(history, /<LiveShotChart/)
  assert.match(history, /<LiveBrewStages/)
})

test('chart stage markers use the same minimal, single-digit pattern everywhere', () => {
  assert.match(markers, /sequence: index \+ 1/)
  assert.match(markers, /chart-stage-marker--first/)
  assert.match(markers, /chart-stage-marker__badge/)
  assert.match(markers, /chart-stage-marker--highlighted/)
  assert.doesNotMatch(markers, /padStart/)
  assert.match(markers, /stageMarkerCanShowName\(stage\.name, stage\.normalizedWidth\)/)
  assert.match(markers, /--chart-stage-width/)
  assert.match(styles, /\.chart-stage-marker__badge \{[^}]*font-size:11px/)
  assert.match(styles, /\.chart-stage-marker__name \{[^}]*font-size:11px/)
  assert.match(builder, /<ChartStageMarkers/)
})

test('the shared legend is static in the profile editor and filterable where requested', () => {
  assert.match(legend, /return interactive\s*\? <button/)
  assert.match(legend, /:\s*<span className="chart-legend__group"/)
  assert.match(builder, /<ChartLegend mode="profile" showWeight=\{false\}/)
  assert.match(liveChart, /interactive=\{legendFilterEnabled\}/)
})
