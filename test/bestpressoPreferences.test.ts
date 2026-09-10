import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { DEFAULT_BESTPRESSO_PREFERENCES, normalizeBestpressoPreferences } from '../src/features/settings/bestpressoPreferences.ts'

test('Bestpresso preferences preserve the released defaults', () => {
  assert.deepEqual(normalizeBestpressoPreferences(undefined), DEFAULT_BESTPRESSO_PREFERENCES)
})

test('water warning preferences remain ordered and within the reservoir control range', () => {
  assert.deepEqual(normalizeBestpressoPreferences({ waterCriticalLevelMl: 500, waterWarningLevelMl: 100 }), {
    completionSoundEnabled: true,
    waterCriticalLevelMl: 500,
    waterWarningLevelMl: 501,
    chartLineWeight: 'fine',
  })
  const maximum = normalizeBestpressoPreferences({ waterCriticalLevelMl: 9_000, waterWarningLevelMl: 9_000 })
  assert.equal(maximum.waterCriticalLevelMl, 1_999)
  assert.equal(maximum.waterWarningLevelMl, 2_000)
})

test('settings are routed inside Bestpresso and expose real preference controls', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
  const screen = readFileSync(new URL('../src/features/settings/SettingsScreen.tsx', import.meta.url), 'utf8')
  const styles = readFileSync(new URL('../src/styles/index.css', import.meta.url), 'utf8')
  assert.match(app, /navigate\('settings'\)/)
  assert.match(screen, /completionSoundEnabled/)
  assert.match(screen, /waterWarningLevelMl/)
  assert.match(screen, /chartLineWeight/)
  assert.match(styles, /data-chart-line-weight="bold"/)
})
