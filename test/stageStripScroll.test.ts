import assert from 'node:assert/strict'
import test from 'node:test'
import { canStartStageMouseDrag, latestStageScrollLeft, STAGE_MOUSE_DRAG_THRESHOLD_PX, stageMouseDragScrollLeft } from '../src/features/brew/stageStripScroll.ts'

test('keeps the first live stage fully aligned to the left', () => {
  assert.equal(latestStageScrollLeft(1, 980, 760), 0)
})

test('follows the newest stage once multiple stages exist', () => {
  assert.equal(latestStageScrollLeft(2, 1180, 760), 420)
})

test('does not create a negative scroll target when the strip fits', () => {
  assert.equal(latestStageScrollLeft(3, 700, 760), 0)
})

test('translates mouse movement into stage-strip scrolling', () => {
  assert.equal(STAGE_MOUSE_DRAG_THRESHOLD_PX, 6)
  assert.equal(canStartStageMouseDrag(false, 'mouse', 0), true)
  assert.equal(canStartStageMouseDrag(true, 'mouse', 0), false)
  assert.equal(canStartStageMouseDrag(false, 'touch', 0), false)
  assert.equal(stageMouseDragScrollLeft(420, 800, 600), 620)
  assert.equal(stageMouseDragScrollLeft(420, 600, 800), 220)
})
