import assert from 'node:assert/strict'
import test from 'node:test'
import { CLEANING_PROFILE_START_STATE, isCleaningSequenceRun } from '../src/features/cleaning/cleaningSequence.ts'

test('runs an uploaded cleaning profile through the espresso state', () => {
  assert.equal(CLEANING_PROFILE_START_STATE, 'espresso')
})

test('keeps an espresso-state cleaning profile in the cleaning UI flow', () => {
  assert.equal(isCleaningSequenceRun('espresso', true, true), true)
  assert.equal(isCleaningSequenceRun('espresso', true, false), false)
  assert.equal(isCleaningSequenceRun('cleaning', false, false), true)
})
