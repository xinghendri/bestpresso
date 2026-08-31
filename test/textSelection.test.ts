import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const styles = readFileSync(new URL('../src/styles/index.css', import.meta.url), 'utf8')
const adjustmentScreen = readFileSync(new URL('../src/components/ValueAdjustment/ValueAdjustmentProvider.tsx', import.meta.url), 'utf8')

test('blocks selection and touch callouts across the Bestpresso root', () => {
  assert.match(styles, /#root,#root \* \{[^}]*user-select:none;[^}]*-webkit-user-select:none;[^}]*-webkit-touch-callout:none;/)
})

test('prevents browser dragging and direct pointer handling on icon images', () => {
  assert.match(styles, /#root img \{[^}]*pointer-events:none;[^}]*-webkit-user-drag:none;/)
})

test('allows selection only on the active keypad number', () => {
  assert.match(adjustmentScreen, /className="value-adjuster__direct-number"/)
  assert.match(styles, /#root \.value-adjuster--keyboard \.value-adjuster__direct-number \{[^}]*user-select:text;[^}]*-webkit-user-select:text;[^}]*-webkit-touch-callout:default;/)
})
