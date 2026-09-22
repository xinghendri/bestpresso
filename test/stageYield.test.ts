import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { displayedStageYield } from '../src/features/brew/stageYield.ts'
import { observePostShotWeight, reconciledShotPoints, reconciledShotYield, withSettledLiveYield } from '../src/features/history/shotYieldFinalization.ts'
import type { LiveBrewState } from '../src/domain/brewing.ts'

test('only the completed last stage includes drips; earlier yields remain cumulative', () => {
  assert.deepEqual([8, 22, 35.2].map((weight, i) => displayedStageYield(weight, i === 2, '36.4')), [8, 22, 36.4])
  assert.equal(displayedStageYield(35.2, false, '36.4'), 35.2)
})

test('unknown totals retain measured yield rather than introducing zero or NaN', () => {
  for (const total of [undefined, '', ' ', '—', 'NaN', 'Infinity', -1, NaN, Infinity]) {
    assert.equal(displayedStageYield(35.2, true, total), 35.2)
    assert.equal(displayedStageYield(undefined, true, total), undefined)
  }
  assert.equal(displayedStageYield(1, true, '0'), 0)
  assert.equal(displayedStageYield(undefined, true, '36.4'), 36.4)
})

test('settling and saved-shot reconciliation match final card to total without changing samples', () => {
  const points = [{ elapsedMs: 0, stageIndex: 0, weight: 8 }, { elapsedMs: 1000, stageIndex: 1, weight: 35.2, weightFlow: 1.2 }]
  const before = structuredClone(points)
  const settled = observePostShotWeight({ bestWeight: 35.2, lastWeight: 35.2, stableSamples: 0 }, 36.4, 0.2)
  const totalYield = reconciledShotYield('35.2', settled.displayWeight)
  const savedPoints = reconciledShotPoints(points, points)
  assert.equal(displayedStageYield(savedPoints.at(-1)?.weight, true, totalYield), Number(totalYield))
  assert.deepEqual(savedPoints, before)
  // Cached history uses the same override after serialization; no migration or network needed.
  const cached = JSON.parse(JSON.stringify({ points: savedPoints, totalYield }))
  assert.equal(displayedStageYield(cached.points.at(-1).weight, true, cached.totalYield), 36.4)
})

const completed: LiveBrewState = {
  active: false, visible: true, kind: 'espresso', startedAt: 100, elapsedMs: 1000,
  scaleWeight: 35.2, points: [{ elapsedMs: 1000, weight: 35.2, weightFlow: 1.2 }],
}

test('completed live view follows settled weight without extending or changing telemetry', () => {
  const updated = withSettledLiveYield(completed, 100, 36.4)
  assert.equal(updated.scaleWeight, 36.4)
  assert.equal(updated.points, completed.points)
  assert.equal(updated.elapsedMs, completed.elapsedMs)
  assert.equal(completed.scaleWeight, 35.2)
  assert.equal(withSettledLiveYield(updated, 100, 36.4), updated)
})

test('late settling cannot change another shot, an active shot, or cleaning', () => {
  for (const current of [{ ...completed, startedAt: 200 }, { ...completed, active: true }, { ...completed, kind: 'cleaning' as const }]) {
    assert.equal(withSettledLiveYield(current, 100, 36.4), current)
  }
  for (const weight of [-1, NaN, Infinity]) assert.equal(withSettledLiveYield(completed, 100, weight), completed)
})

test('both screens pass their header yield; stage override is final-and-completed only', () => {
  const source = (file: string) => readFileSync(new URL(`../src/features/${file}`, import.meta.url), 'utf8')
  assert.match(source('history/PreviousShotScreen.tsx'), /finalYield=\{activeShot\?\.totalYield\}/)
  assert.match(source('brew/LiveBrewingScreen.tsx'), /finalYield=\{weight\}/)
  assert.match(source('brew/LiveBrewStages.tsx'), /displayedStageYield\(stage.yield, !active && index === stages.length - 1, finalYield\)/)
  assert.match(source('brew/useBrewingData.ts'), /withSettledLiveYield\(current, startedAt, weight\)/)
})
