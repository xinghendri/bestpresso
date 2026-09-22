import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const styles = readFileSync(new URL('../src/styles/index.css', import.meta.url), 'utf8')

test('utility modals hug their metric content at tablet and phone widths', () => {
  assert.match(styles, /\.live-utility-card \{[^}]*height:auto;[^}]*grid-template-rows:97px auto;/)
  assert.match(styles, /@media\(max-width:560px\)\{\.live-utility-card\{width:100%;grid-template-rows:87px auto\}/)
  assert.doesNotMatch(styles, /\.live-utility-card\s*\{[^}]*height:\d+px/)
  assert.match(styles, /\.live-utility-card__metrics \{[^}]*padding:24px;/)
  assert.match(styles, /\.live-utility-card__metrics\{[^}]*padding:20px 18px/)
})
