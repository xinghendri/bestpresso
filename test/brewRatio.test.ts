import assert from 'node:assert/strict'
import test from 'node:test'
import { doseToYieldRatio } from '../src/features/brew/brewRatio.ts'

test('omits the decimal when the brew ratio is a whole number', () => {
  assert.equal(doseToYieldRatio(20, 40), '1:2 ratio')
  assert.equal(doseToYieldRatio(18, 54), '1:3 ratio')
})

test('keeps one decimal when the brew ratio is not a whole number', () => {
  assert.equal(doseToYieldRatio(18, 40), '1:2.2 ratio')
  assert.equal(doseToYieldRatio(20, 45), '1:2.3 ratio')
})

test('does not format an unusable dose or yield', () => {
  assert.equal(doseToYieldRatio(0, 40), undefined)
  assert.equal(doseToYieldRatio('not-set', 40), undefined)
})
