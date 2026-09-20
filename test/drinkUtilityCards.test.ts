import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { applyWorkflow } from '../src/api/decaid/adapters.ts'
import type { BrewingScreenModel } from '../src/domain/brewing.ts'
import { VALUE_ADJUSTMENTS } from '../src/domain/valueAdjustments.ts'
import { SETTINGS_PROTOCOL } from '../src/features/settings/settingsProtocol.ts'

const model = { profiles: [], utilities: [
  { id: 'water', metrics: [{ id: 'volume', value: '50', unit: 'ml' }, { id: 'temperature', value: '92', unit: '°' }] },
  { id: 'steam', enabled: true, metrics: [{ id: 'current', value: '45', unit: '°' }, { id: 'target', value: '160', unit: '°' }, { id: 'duration', value: '50', unit: 's' }, { id: 'flow', value: '0.7', unit: 'ml/s' }] },
] } as BrewingScreenModel
const water = (value: BrewingScreenModel) => Object.fromEntries(value.utilities[0].metrics.map(m => [m.id, m.value]))

test('unknown steam uses a disabled neutral control, not an on/off claim or animated loader', () => {
  const source = readFileSync(new URL('../src/features/machine/DrinkUtilityCard.tsx', import.meta.url), 'utf8')
  const css = readFileSync(new URL('../src/features/machine/drinkUtilityCards.css', import.meta.url), 'utf8')
  assert.match(source, /const pending = steam && utility.enabled === undefined/)
  assert.match(source, /aria-checked=\{pending \? undefined : enabled\}/)
  assert.match(source, /disabled=\{pending \|\| disabled\}/)
  assert.match(source, /const currentValid = !pending &&/)
  assert.match(source, /const targetDisabled = pending \|\|/)
  assert.match(css, /steam-pending \.drink-card__toggle>span \{[^}]*transform:translateX\(10px\);[^}]*transition:none/)
})

test('adds max duration to an older two-metric hot-water model from the workflow', () => {
  const updated = applyWorkflow(model, { hotWaterData: { duration: 35 } }, [])
  assert.deepEqual(water(updated), { volume: '50', temperature: '92', maxDuration: '35' })
  assert.equal(model.utilities[0].metrics.length, 2)
  assert.equal(applyWorkflow(updated, { hotWaterData: { duration: 40 } }, []).utilities[0].metrics.length, 3)
})

test('partial workflow refreshes keep independent hot-water values and preserve zero', () => {
  const updated = applyWorkflow(model, { hotWaterData: { volume: 70, targetTemperature: 60, duration: 30 } }, [])
  assert.deepEqual(water(applyWorkflow(updated, { hotWaterData: { duration: 0 } }, [])), { volume: '70', temperature: '60', maxDuration: '0' })
  assert.deepEqual(water(applyWorkflow(updated, {}, [])), water(updated))
})

test('steam on/off preserves target, flow, duration, and actual heater reading', () => {
  const off = applyWorkflow(model, { steamSettings: { targetTemperature: 0 } }, [])
  assert.equal(off.utilities[1].enabled, false)
  assert.deepEqual(off.utilities[1].metrics, model.utilities[1].metrics)
  const on = applyWorkflow(off, { steamSettings: { targetTemperature: 160 } }, [])
  assert.equal(on.utilities[1].enabled, true)
  assert.deepEqual(on.utilities[1].metrics, model.utilities[1].metrics)
})

test('hot-water duration remains supported with the same adjustment range as Settings', () => {
  const { min, max, step } = VALUE_ADJUSTMENTS.hotWaterDuration
  assert.deepEqual({ min, max, step }, SETTINGS_PROTOCOL.hotWater.duration)
})

test('only the home hot-water duration shortcut is removed, not the Settings limit', () => {
  const source = readFileSync(new URL('../src/features/machine/DrinkUtilityCard.tsx', import.meta.url), 'utf8')
  const waterCard = source.split('!steam ? <div className="drink-card__water-settings">')[1].split(': <div className="drink-card__steam-settings">')[0]
  assert.deepEqual([...waterCard.matchAll(/displayMetric\('([^']+)'\)/g)].map(match => match[1]), ['temperature', 'volume'])
  const settings = readFileSync(new URL('../src/features/settings/SettingsScreen.tsx', import.meta.url), 'utf8')
  assert.match(settings, /NumberSetting label=\{t\('common\.metric\.maxDuration'\)\} value=\{numberValue\(settings\.draft\.workflow\.hotWaterData\?\.duration\)\}/)
  assert.match(settings, /onChange=\{\(duration\) => settings\.patchWorkflow\('hotWaterData', \{ duration \}\)\}/)
})

test('collapsed cards keep their original summaries and hidden controls cannot receive focus', () => {
  const source = readFileSync(new URL('../src/features/machine/DrinkUtilityCard.tsx', import.meta.url), 'utf8')
  assert.match(source, /\(\['volume', 'temperature'\] as const\)\.map\(metric\)/)
  assert.match(source, /inert=\{!compact\} aria-hidden=\{!compact\}/)
  assert.match(source, /inert=\{compact\} aria-hidden=\{compact\}/)
  assert.match(source, /displayMetric\('duration', utilityMetricLabel\('maxDuration'\)\)/)
  assert.doesNotMatch(source, /displayMetric\('maxDuration'\)/)
  assert.match(source, /metric__edit-indicator/)
})

test('motion uses CSS interpolation, the shared 520ms card timing, and reduced-motion support', () => {
  const css = readFileSync(new URL('../src/features/machine/drinkUtilityCards.css', import.meta.url), 'utf8')
  assert.match(css, /--drink-motion:\.52s/)
  assert.match(css, /--drink-ease:cubic-bezier\(\.22,\.72,\.28,1\)/)
  assert.match(css, /stroke-dashoffset \.24s linear/)
  assert.match(css, /transition:opacity \.38s \.14s ease/)
  assert.match(css, /prefers-reduced-motion:reduce/)
  assert.match(css, /\.drink-card__compact \.utility-card__metrics \{margin:0\}/)
  assert.match(css, /inset:50px 0 8px;row-gap:4px/)
  const digits = readFileSync(new URL('../src/features/machine/TemperatureReading.tsx', import.meta.url), 'utf8')
  assert.doesNotMatch(digits, /requestAnimationFrame|setInterval/)
})

test('narrow cards reflow controls without reducing label or temperature sizes', () => {
  const css = readFileSync(new URL('../src/features/machine/drinkUtilityCards.css', import.meta.url), 'utf8')
  const narrow = css.split('@container (max-width:340px) {')[1].split('@media(max-width:760px)')[0]
  assert.match(css, /water-settings \{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/)
  assert.match(css, /height:var\(--drink-metric-height\);align-self:start;margin:0 12px/)
  assert.doesNotMatch(css, /drink-card__water-duration/)
  assert.match(css, /steam-settings \{min-height:0;display:grid;grid-template-columns:minmax\(0,1fr\)/)
  assert.match(css, /grid-template-rows:minmax\(0,1fr\) var\(--drink-metric-height\);gap:8px;padding:0 12px 2px/)
  assert.match(css, /steam-secondary \{min-width:0;height:var\(--drink-metric-height\);display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/)
  assert.match(css, /steam-secondary>div\+div::before \{[^}]*top:12px;bottom:12px;width:1px;background:var\(--drink-separator\)/)
  assert.doesNotMatch(css, /(?:water-settings|steam-secondary)>div\+div \{border-left:/)
  assert.match(narrow, /steam-secondary \.metric \{min-height:48px;gap:5px\}/)
  assert.doesNotMatch(narrow, /font-size|transform:scale/)
})

test('tablet grid reserves space for controls and keeps one shared row layout when collapsed', () => {
  const css = readFileSync(new URL('../src/features/machine/drinkUtilityCards.css', import.meta.url), 'utf8')
  const tablet = css.split('@media(min-width:761px) and (max-width:1180px) {')[1].split('@media(min-width:761px) and (max-width:899px)')[0]
  assert.match(tablet, /--utility-panel-expanded-width:clamp\(244px,32vw,340px\)/)
  assert.match(tablet, /grid-template-rows:114px minmax\(234px,1fr\) clamp\(114px,21vh,180px\)/)
  assert.match(tablet, /--drink-header-height:48px/)
  assert.doesNotMatch(tablet, /drink-card\.utility-card--(?:water|steam) \{--drink-header-height:/)
  assert.match(css, /grid-template-rows:114px minmax\(234px,1fr\) clamp\(134px,21vh,180px\)/)
  assert.match(tablet, /inset:40px 0 6px;row-gap:0/)
  assert.doesNotMatch(tablet, /--utility-panel-width:|app-shell--utilities-collapsed/)
  assert.match(tablet, /utility-card--scale\.utility-card--compact \.utility-card__metrics \{top:auto;bottom:12px/)
  assert.match(tablet, /ins-home-entry \{min-height:0\}/)
  assert.match(tablet, /ins-entry-card \{container-type:inline-size\}/)
  assert.match(tablet, /ins-entry-shot-caption>strong \{font-size:14px;line-height:18px\}/)
})

test('responsive arc uses a matching viewport without squashing the arc or its labels', () => {
  const source = readFileSync(new URL('../src/features/machine/DrinkUtilityCard.tsx', import.meta.url), 'utf8')
  const css = readFileSync(new URL('../src/features/machine/drinkUtilityCards.css', import.meta.url), 'utf8')
  assert.ok(source.includes('viewBox={`0 0 197 ${gaugeViewHeight}`}'))
  assert.match(css, /aspect-ratio:197 \/ var\(--gauge-view-height\)/)
  assert.match(css, /transform:translateY\(8px\)/)
  assert.match(css, /--drink-metric-height:64px/)
  assert.match(css, /--drink-header-height:48px/)
  assert.match(source, /observer\.disconnect\(\)/)
  assert.doesNotMatch(source, /preserveAspectRatio="none"/)
})

test('light utility cards share the scale surface in both states without a grey inner face', () => {
  const css = readFileSync(new URL('../src/features/machine/drinkUtilityCards.css', import.meta.url), 'utf8')
  assert.match(css, /\[data-theme="light"\] \.app-shell \.drink-card \{background:var\(--card-surface\)\}/)
  assert.match(css, /\.drink-card__compact:hover \{background:transparent;box-shadow:none\}/)
  assert.doesNotMatch(css, /background:var\(--light-home-control\)/)
  assert.match(css, /water-settings>div \{display:grid;align-content:center/)
})

test('roomier tablets use 80px metric blocks while small and short tablets keep 64px', () => {
  const css = readFileSync(new URL('../src/features/machine/drinkUtilityCards.css', import.meta.url), 'utf8')
  const tablet = css.split('@media(min-width:900px) and (min-height:681px) {')[1].split('@container')[0]
  assert.match(css, /--drink-metric-height:64px/)
  assert.match(tablet, /--drink-metric-height:80px/)
  assert.match(tablet, /grid-template-rows:130px minmax\(234px,1fr\)/)
})

test('only steam temperature places its adjustment label after the values', () => {
  const source = readFileSync(new URL('../src/features/machine/DrinkUtilityCard.tsx', import.meta.url), 'utf8')
  const group = source.split('<button className="drink-card__temperature')[1].split('</button>')[0]
  assert.ok(group.indexOf('drink-card__temperature-pair') < group.indexOf('className="metric__label"'))
  assert.ok(group.indexOf('drink-card__target') < group.indexOf('className="metric__label"'))
  assert.match(group, /\{t\('common\.metric\.temperature'\)\}\{!targetDisabled/)
})

test('steam temperature block shifts independently from the arc and target value', () => {
  const css = readFileSync(new URL('../src/features/machine/drinkUtilityCards.css', import.meta.url), 'utf8')
  assert.match(css, /\.drink-card__temperature \{[^}]*transform:translate\(4px,12px\)/)
  assert.match(css, /\.drink-card__target\.metric__reading \{[^}]*transform:translate\(-12px,-4px\)/)
  assert.match(css, /\.drink-card__gauge \{[^}]*transform:translateY\(8px\)/)
})

test('expanded and compact steam indicators share the Celsius readiness tolerance', () => {
  const source = readFileSync(new URL('../src/features/machine/DrinkUtilityCard.tsx', import.meta.url), 'utf8')
  assert.match(source, /const heating = steamBelowReadyRange\(currentC, targetC, enabled\)/)
  assert.match(source, /highlight: heating/)
  assert.match(source, /heating \? ' is-heating'/)
})

test('taller arc lifts the temperature block eight pixels without changing the shallow layout', () => {
  const css = readFileSync(new URL('../src/features/machine/drinkUtilityCards.css', import.meta.url), 'utf8')
  assert.match(css, /\[data-tall=true\] \.drink-card__temperature \{top:35%;transform:translate\(4px,4px\)/)
  assert.match(css, /\.drink-card__temperature \{[^}]*transform:translate\(4px,12px\)/)
})

test('localized off words clear the slash without changing live numeric alignment', () => {
  const css = readFileSync(new URL('../src/features/machine/drinkUtilityCards.css', import.meta.url), 'utf8')
  assert.match(css, /\.drink-card__current-off \{opacity:0;transform:translateX\(-8px\)\}/)
  assert.match(css, /\.drink-card__current\.metric__reading \{[^}]*transform:translateX\(14px\)/)
  assert.match(css, /\.drink-card__current-live,\.drink-card__current-off \{grid-area:1\/1;transition:opacity/)
})

test('steam gauge emphasizes the current reading while keeping the target secondary', () => {
  const css = readFileSync(new URL('../src/features/machine/drinkUtilityCards.css', import.meta.url), 'utf8')
  assert.match(css, /\.drink-card__current\.metric__reading \{[^}]*font-size:28px;[^}]*line-height:32px/)
  assert.match(css, /\.drink-card__target\.metric__reading \{[^}]*font-size:16px;[^}]*line-height:20px/)
  assert.match(css, /\.drink-card__temperature-pair \{[^}]*height:46px/)
  assert.match(css, /\.drink-card__temperature-pair \{[^}]*transform:translateX\(-3px\)/)
})
