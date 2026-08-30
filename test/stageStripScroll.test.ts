import assert from 'node:assert/strict'
import test from 'node:test'
import { latestStageScrollLeft, stageTerminalInsets } from '../src/features/brew/stageStripScroll.ts'

test('keeps the first live stage fully aligned to the left', () => {
  assert.equal(latestStageScrollLeft(1, 980, 760), 0)
})

test('follows the newest stage once multiple stages exist', () => {
  assert.equal(latestStageScrollLeft(2, 1180, 760), 420)
})

test('does not create a negative scroll target when the strip fits', () => {
  assert.equal(latestStageScrollLeft(3, 700, 760), 0)
})

test('keeps the preferred terminal insets for cards that fit comfortably', () => {
  assert.deepEqual(stageTerminalInsets(807, 280, 380), { start: 16, end: 16 })
})

test('shrinks only the end inset when the last card nearly fills the strip', () => {
  assert.deepEqual(stageTerminalInsets(807, 280, 800), { start: 16, end: 5 })
})

test('shrinks only the start inset when the first card nearly fills the strip', () => {
  assert.deepEqual(stageTerminalInsets(807, 801, 380), { start: 4, end: 16 })
})

test('never creates a negative terminal inset for a card wider than its viewport', () => {
  assert.deepEqual(stageTerminalInsets(760, 900, 920), { start: 0, end: 0 })
})
