import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { pressureChainSlotCount } from '../src/features/brew/stageCardSizing.ts'

const stages = readFileSync(new URL('../src/features/brew/LiveBrewStages.tsx', import.meta.url), 'utf8')
const styles = readFileSync(new URL('../src/styles/index.css', import.meta.url), 'utf8')

test('pressure capacity only grows as real direction changes are added', () => {
  const pressures = [0, 1, 0, 1, 0, 1, 0, 1, 0]
  const capacities = pressures.map((_, index) => pressureChainSlotCount(pressures.slice(0, index + 1), 0.4))
  assert.deepEqual(capacities, [1, 2, 3, 4, 5, 6, 7, 8, 9])
})

test('ordinary value changes do not alter a pressure chain capacity', () => {
  assert.equal(pressureChainSlotCount([8.1], 0.4), 1)
  assert.equal(pressureChainSlotCount([10], 0.4), 1)
  assert.equal(pressureChainSlotCount([2, 8.1, 10], 0.4), 2)
})

test('reserves numeric slots without assigning a fixed card width', () => {
  assert.match(stages, /Array\.from\(\{ length: stage\.pressureSlotCount \}/)
  assert.match(styles, /\.live-brew-stage__yield-value \{ min-width:4ch;[^}]*text-align:left;/)
  assert.match(styles, /\.live-brew-stage__pressure-reading \{ min-width:3\.75ch;[^}]*text-align:left;/)
  assert.match(styles, /\.live-brew-stage__pressure-reading--reserved \{ visibility:hidden;/)
  assert.match(styles, /\.live-brew-stage \{ width:max-content;/)
})

test('keeps the live stage strip flush with both viewport edges', () => {
  assert.match(styles, /\.live-brew-screen>\.live-brew-stages \{[^}]*width:100vw; margin-left:calc\(50% - 50vw\);/)
})
