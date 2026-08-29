import assert from 'node:assert/strict'
import test from 'node:test'
import { gestureIncrement, maximumGesturePointers, modeForNumericDraft, modeForShortcut, normalizedNumericDraft, numericDraftRangeIssue } from '../src/components/ValueAdjustment/valueAdjustmentGestures.ts'
import { VALUE_ADJUSTMENTS } from '../src/domain/valueAdjustments.ts'

test('mixed grind shortcuts choose their matching number format', () => {
  assert.equal(modeForShortcut(200, true, 'decimal'), 'integer')
  assert.equal(modeForShortcut(18.3, true, 'integer'), 'decimal')
  assert.equal(modeForShortcut(18.3, false, 'integer'), 'integer')
})

test('one finger follows the selected ruler precision', () => {
  assert.equal(gestureIncrement('decimal', 1, true), 0.1)
  assert.equal(gestureIncrement('integer', 1, true), 1)
})

test('two fingers move by ten for every adjustment ruler', () => {
  assert.equal(gestureIncrement('decimal', 2, false), 10)
  assert.equal(gestureIncrement('integer', 2, true), 10)
})

test('three fingers move by one hundred only for grind size', () => {
  assert.equal(gestureIncrement('integer', 3, true), 100)
  assert.equal(gestureIncrement('decimal', 3, false), null)
  assert.equal(maximumGesturePointers(true), 3)
  assert.equal(maximumGesturePointers(false), 2)
})

test('grind size keeps the requested default and full reference range', () => {
  assert.equal(VALUE_ADJUSTMENTS.grindSetting.defaultValue, 20)
  assert.equal(VALUE_ADJUSTMENTS.grindSetting.max, 2500)
  assert.deepEqual(VALUE_ADJUSTMENTS.grindSetting.modes, ['integer', 'decimal'])
})

test('direct numeric entry accepts integers and locale decimal separators', () => {
  assert.equal(modeForNumericDraft('1200', 'decimal'), 'integer')
  assert.equal(modeForNumericDraft('18.3', 'integer'), 'decimal')
  assert.equal(modeForNumericDraft('18.', 'integer'), 'decimal')
  assert.equal(modeForNumericDraft('.5', 'integer'), 'decimal')
  assert.equal(normalizedNumericDraft('18,3'), '18.3')
})

test('direct numeric entry reports values outside the allowed range', () => {
  assert.equal(numericDraftRangeIssue('', 0, 2500), 'required')
  assert.equal(numericDraftRangeIssue('-1', 0, 2500), 'below')
  assert.equal(numericDraftRangeIssue('2500', 0, 2500), null)
  assert.equal(numericDraftRangeIssue('2500.1', 0, 2500), 'above')
})
