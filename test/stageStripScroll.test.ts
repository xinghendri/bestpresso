import assert from 'node:assert/strict'
import test from 'node:test'
import { latestStageScrollLeft } from '../src/features/brew/stageStripScroll.ts'

test('keeps the first live stage fully aligned to the left', () => {
  assert.equal(latestStageScrollLeft(1, 980, 760), 0)
})

test('follows the newest stage once multiple stages exist', () => {
  assert.equal(latestStageScrollLeft(2, 1180, 760), 420)
})

test('does not create a negative scroll target when the strip fits', () => {
  assert.equal(latestStageScrollLeft(3, 700, 760), 0)
})
