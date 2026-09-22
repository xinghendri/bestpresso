import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import test from 'node:test'

const screen = readFileSync(new URL('../src/features/sleep/SleepWakeScreen.tsx', import.meta.url), 'utf8')
const policy = readFileSync(new URL('../src/features/settings/displayBrightnessPolicy.ts', import.meta.url), 'utf8')
const styles = readFileSync(new URL('../src/styles/index.css', import.meta.url), 'utf8')

test('the sleep screen arms the timed blackout only for a positive delay', () => {
  assert.match(screen, /const delaySeconds = readBestpressoPreferences\(\).screensaverScreenOffDelaySeconds/)
  assert.match(screen, /if \(delaySeconds > 0\)/)
  assert.match(screen, /displayBrightness\.deepen\(SCREEN_OFF_BRIGHTNESS\)\.catch\(\(\) => \{\}\)/)
})

test('a fired blackout stops the clock and hides the saver content', () => {
  assert.match(screen, /setBlackedOut\(true\)/)
  assert.match(screen, /window\.clearInterval\(clockTimer\.current\)/)
  assert.match(screen, /data-blacked-out=\{blackedOut \? 'true' : undefined\}/)
  assert.match(screen, /!blackedOut && <span className="sleep-screen__identity"/)
  assert.match(screen, /!blackedOut && <span className="sleep-screen__hint"/)
  assert.match(styles, /\.sleep-screen\[data-blacked-out="true"\]\{background:#000\}/)
})

test('unmounting cancels a pending blackout, so wake and disconnect keep the restore path', () => {
  assert.match(screen, /if \(screenOffTimer\.current !== null\) window\.clearTimeout\(screenOffTimer\.current\)/)
})

test('the policy deepens only an active dim session and never rewrites the restore value', () => {
  assert.match(policy, /deepen: \(value: number\) => enqueue\(async \(\) => \{/)
  assert.match(policy, /if \(!dimmed\) return\n      await api\.write\(value\)/)
})