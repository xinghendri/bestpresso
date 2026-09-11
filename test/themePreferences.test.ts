import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { applyBestpressoPreferences, BESTPRESSO_PREFERENCES_KEY, normalizeBestpressoPreferences, readBestpressoPreferences, writeBestpressoPreferences } from '../src/features/settings/bestpressoPreferences.ts'

test('new, existing and invalid preferences stay dark until light is explicitly chosen', () => {
  for (const value of [undefined, null, {}, { theme: 'system' }, { theme: 'LIGHT' }, { theme: false }, { clockFormat: '24h' }]) {
    assert.equal(normalizeBestpressoPreferences(value).theme, 'dark')
  }
  assert.equal(normalizeBestpressoPreferences({ theme: 'light' }).theme, 'light')
  assert.equal(normalizeBestpressoPreferences({ theme: 'dark' }).theme, 'dark')
})

test('explicit light and dark choices persist and unrelated saves preserve the chosen theme', (t) => {
  const storage = new Map<string, string>()
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
  const dataset: Record<string, string> = {}
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    localStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) },
    dispatchEvent: () => true,
  } })
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { documentElement: { dataset }, querySelector: () => null } })
  t.after(() => {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow)
    else Reflect.deleteProperty(globalThis, 'window')
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument)
    else Reflect.deleteProperty(globalThis, 'document')
  })
  applyBestpressoPreferences()
  assert.equal(dataset.theme, 'dark')
  writeBestpressoPreferences({ theme: 'light' })
  assert.equal(dataset.theme, 'light')
  assert.equal(readBestpressoPreferences().theme, 'light')
  writeBestpressoPreferences({ clockFormat: '24h' })
  assert.equal(JSON.parse(storage.get(BESTPRESSO_PREFERENCES_KEY)!).theme, 'light')
  applyBestpressoPreferences(readBestpressoPreferences())
  assert.equal(dataset.theme, 'light')
  writeBestpressoPreferences({ theme: 'dark' })
  assert.equal(readBestpressoPreferences().theme, 'dark')
  assert.equal(dataset.theme, 'dark')
  storage.set(BESTPRESSO_PREFERENCES_KEY, '{invalid json')
  assert.equal(readBestpressoPreferences().theme, 'dark')
})

test('appearance selector labels light as beta and does not depend on the Decaid theme', () => {
  const screen = readFileSync(new URL('../src/features/settings/SettingsScreen.tsx', import.meta.url), 'utf8')
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
  assert.match(screen, /label="Bestpresso theme"[^>]+value=\{preferences.theme\}/)
  assert.match(screen, /label: 'Light \(Beta\)'/)
  assert.match(screen, /label="Decaid system theme"/)
  assert.doesNotMatch(app, /get\('theme'\)/)
})
