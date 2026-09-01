import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const stages = readFileSync(new URL('../src/features/brew/LiveBrewStages.tsx', import.meta.url), 'utf8')
const brewingData = readFileSync(new URL('../src/features/brew/useBrewingData.ts', import.meta.url), 'utf8')
const styles = readFileSync(new URL('../src/styles/index.css', import.meta.url), 'utf8')

test('uses one stable clock for rapid skip confirmation', () => {
  assert.match(stages, /registerDoubleTap\(previousSkipTap\.current, Date\.now\(\)\)/)
  assert.doesNotMatch(stages, /registerDoubleTap\(previousSkipTap\.current, event\.timeStamp\)/)
})

test('contains the complete skip gesture inside its button', () => {
  assert.match(stages, /event\.preventDefault\(\)[\s\S]*event\.stopPropagation\(\)/)
  assert.match(stages, /onPointerDown=\{consumeSkipPointer\}/)
  assert.match(stages, /onPointerUp=\{consumeSkipPointer\}/)
  assert.match(stages, /onPointerCancel=\{consumeSkipPointer\}/)
  assert.match(stages, /onDoubleClick=\{consumeSkipDoubleClick\}/)
  assert.match(styles, /\.live-brew-skip \{[^}]*touch-action:none;/)
})

test('does not let profile refresh or selection replace the active shot profile', () => {
  assert.match(brewingData, /if \(disposed \|\| liveShotSession\.current \|\|/)
  assert.match(brewingData, /const selectProfile = async \(profileId: string\) => \{\s*if \(liveShotSession\.current\) return false/)
})
