import assert from 'node:assert/strict'
import test from 'node:test'
import { DOUBLE_TAP_CONFIRMATION_WINDOW_MS, registerDoubleTap } from '../src/features/brew/doubleTapConfirmation.ts'

test('the first tap arms the confirmation without skipping', () => {
  assert.deepEqual(registerDoubleTap(null, 1_000), { confirmed: false, nextTapAt: 1_000 })
})

test('a second tap inside the confirmation window triggers one skip', () => {
  assert.deepEqual(registerDoubleTap(1_000, 1_450), { confirmed: true, nextTapAt: null })
})

test('a late second tap starts a new confirmation window', () => {
  const tapAt = 1_000 + DOUBLE_TAP_CONFIRMATION_WINDOW_MS + 1
  assert.deepEqual(registerDoubleTap(1_000, tapAt), { confirmed: false, nextTapAt: tapAt })
})
