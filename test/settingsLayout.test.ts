import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import test from 'node:test'

const screen = readFileSync(new URL('../src/features/settings/SettingsScreen.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../src/styles/settingsLayout.css', import.meta.url), 'utf8')

test('hot water keeps four controls in two balanced columns', () => {
  const card = screen.split('title="Dispenser defaults"')[1].split('</SettingsCard>')[0]
  const lists = [...card.matchAll(/<SectionList>(.*?)<\/SectionList>/g)].map(match => match[1])
  assert.equal(lists.length, 2)
  assert.deepEqual(lists.map(list => (list.match(/<(?:Number|Temperature)Setting /g) || []).length), [2, 2])
  for (const field of ['Temperature', 'Amount', 'Flow', 'Duration backstop']) assert.equal(card.split(`label="${field}"`).length - 1, 1)
})

test('power controls remain present once, grouped in independent screen and sleep stacks', () => {
  const power = screen.split('const power =')[1].split('const experience =')[0]
  assert.equal((power.match(/className="settings-stack"/g) || []).length, 2)
  for (const label of ['Brightness', 'Screensaver brightness', 'Keep screen awake', 'Presence detection', 'Sleep after', 'Charging mode', 'Overnight charging schedule']) {
    assert.equal(power.split(`label="${label}"`).length - 1, 1, label)
  }
  assert.match(power, /title="Wake times"/)
  assert.match(power, /settings\.createSchedule/)
  assert.match(power, /settings\.updateSchedule/)
  assert.match(power, /settings\.deleteSchedule/)
})

test('reset action lives inside an explanatory card and still only stages local defaults', () => {
  const experience = screen.split('const experience =')[1].split('const onImport =')[0]
  assert.match(experience, /title="Reset preferences"[^]*?onClick=\{resetPreferences\}[^]*?<\/SettingsCard>/)
  assert.match(screen, /const resetPreferences = \(\) => setPreferencePatch\(DEFAULT_BESTPRESSO_PREFERENCES\)/)
})

test('lists remove trailing separators, retaining the boundary when columns collapse', () => {
  assert.match(css, /\.settings-list>\.settings-row:last-child \{border-bottom:0\}/)
  assert.match(css, /@media\(max-width:999px\)[^]*?\.settings-columns>\.settings-form-list:not\(:last-child\)>:last-child \{border-bottom:1px/)
})

test('light settings explicitly cover enabled, disabled and nested action colors', () => {
  for (const selector of ['.settings-device button.is-danger', '.settings-device button:disabled', '.settings-routine-actions>button em', '.settings-action-button', '.settings-card--hero>div span.is-connected', '.settings-time-pair input']) assert.ok(css.includes(selector), selector)
})
