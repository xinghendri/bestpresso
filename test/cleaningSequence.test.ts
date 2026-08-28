import assert from 'node:assert/strict'
import test from 'node:test'
import { CLEANING_PROFILE_START_STATE, isCleaningSequenceRun, profileForCleaningShortcut } from '../src/features/cleaning/cleaningSequence.ts'

test('runs an uploaded cleaning profile through the espresso state', () => {
  assert.equal(CLEANING_PROFILE_START_STATE, 'espresso')
})

test('keeps an espresso-state cleaning profile in the cleaning UI flow', () => {
  assert.equal(isCleaningSequenceRun('espresso', true, true), true)
  assert.equal(isCleaningSequenceRun('espresso', true, false), false)
  assert.equal(isCleaningSequenceRun('cleaning', false, false), true)
})

test('normalizes a legacy title-classified profile only for cleaning execution', () => {
  const storedProfile = {
    title: 'Cleaning/Forward Flush x5',
    beverage_type: 'espresso',
    steps: [{ name: 'Pressure rise 1', pressure: 10 }],
  }

  const executionProfile = profileForCleaningShortcut(storedProfile)

  assert.notEqual(executionProfile, storedProfile)
  assert.equal(executionProfile.beverage_type, 'cleaning')
  assert.equal(storedProfile.beverage_type, 'espresso')
  assert.deepEqual(executionProfile.steps, storedProfile.steps)
})

test('preserves an already valid cleaning profile', () => {
  const storedProfile = {
    title: 'Cleaning/Backflush',
    beverage_type: 'cleaning',
    steps: [{ name: 'Fill', flow: 6 }],
  }

  assert.equal(profileForCleaningShortcut(storedProfile), storedProfile)
})
