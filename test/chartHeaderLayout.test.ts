import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('shared shot chart reserves separate legend and stage rows above the plot', () => {
  const styles = readFileSync(new URL('../src/styles/index.css', import.meta.url), 'utf8')
  const chart = readFileSync(new URL('../src/features/brew/LiveShotChart.tsx', import.meta.url), 'utf8')
  assert.match(styles, /\.live-shot-chart \{[^}]*display:flex;[^}]*flex-direction:column/)
  assert.match(styles, /\.live-shot-chart>\.chart-legend \{[^}]*position:relative;[^}]*flex-wrap:wrap/)
  const stageRules = [...styles.matchAll(/\.live-shot-chart>\.chart-stage-markers \{([^}]+)\}/g)]
  assert.match(stageRules.at(-1)![1], /position:relative; inset:auto; flex:0 0 24px/)
  assert.match(chart, /<ChartLegend[\s\S]*<ChartStageMarkers[\s\S]*<div className="live-shot-chart__plot">[\s\S]*<svg ref=\{svgRef\}/)
})
