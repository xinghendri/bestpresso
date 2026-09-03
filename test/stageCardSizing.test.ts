import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { pressureChainMinimumWidth, pressureChainSlotCount } from '../src/features/brew/stageCardSizing.ts'

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

test('reserves predictable chain width without controlling separator placement', () => {
  assert.equal(pressureChainMinimumWidth(1), '3.75ch')
  assert.equal(pressureChainMinimumWidth(3), '15.85ch')
  assert.equal(pressureChainMinimumWidth(9), '52.15ch')
})

test('reserves numeric slots without assigning a fixed card width', () => {
  assert.match(stages, /pressureChainMinimumWidth\(stage\.pressureSlotCount\)/)
  assert.match(styles, /\.live-brew-stage__yield-value \{ min-width:4ch;[^}]*text-align:left;/)
  assert.match(styles, /\.live-brew-stage__pressure-chain \{[^}]*text-align:left;/)
  assert.match(styles, /\.live-brew-stage__pressure-arrow \{[^}]*margin-inline:\.65ch;[^}]*text-align:center;/)
  assert.match(styles, /\.live-brew-stage \{ width:max-content;/)
})

test('keeps the live stage strip flush with both viewport edges', () => {
  assert.match(styles, /\.live-brew-screen>\.live-brew-stages \{ --stage-strip-start-inset:var\(--live-screen-inline-inset\); --stage-strip-end-inset:var\(--live-screen-inline-inset\); width:100vw; margin-left:calc\(50% - 50vw\);/)
})
