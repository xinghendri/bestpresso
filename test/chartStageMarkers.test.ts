import assert from 'node:assert/strict'
import test from 'node:test'
import { stageMarkerCanShowName } from '../src/features/brew/chartStageMarkerLayout.ts'

test('shows a stage title only when its time segment has enough room', () => {
  assert.equal(stageMarkerCanShowName('Bloom', 80), true)
  assert.equal(stageMarkerCanShowName('Preinfusion', 80), false)
  assert.equal(stageMarkerCanShowName('Adaptive decline', 130), false)
  assert.equal(stageMarkerCanShowName('Adaptive decline', 165), true)
})
