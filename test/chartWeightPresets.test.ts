import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const styles = readFileSync(new URL('../src/styles/index.css', import.meta.url), 'utf8')
const screen = readFileSync(new URL('../src/features/settings/SettingsScreen.tsx', import.meta.url), 'utf8')

test('all chart families and legends use the requested weight presets', () => {
  for (const [index, [key, width]] of Object.entries({ fine: 1, standard: 1.75, bold: 2.5 }).entries()) {
    const rule = styles.split(`:root[data-chart-line-weight="${key}"]{`)[1].split('}')[0]
    for (const variable of ['line-width', 'detail-line-width', 'detail-temperature-width', 'thumbnail-line-width', 'builder-line-width']) {
      assert.ok(rule.includes(`--chart-${variable}:${width};`), `${key} ${variable}`)
    }
    assert.ok(rule.includes(`--chart-legend-width:${width}px`))
    assert.ok(styles.includes(`.settings-line-options button:nth-child(${index + 1}) path{stroke-width:${width}}`))
  }
})

test('settings present simple weight names without pixel values', () => {
  assert.match(screen, /fine: 'Thin', standard: 'Medium', bold: 'Thick'/)
  assert.doesNotMatch(screen, /(?:Thin|Medium|Thick) · [\d.]+px/)
  assert.doesNotMatch(screen, /<strong>\{preferences.chartLineWeight\}<\/strong>/)
})
