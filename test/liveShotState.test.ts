import assert from 'node:assert/strict'
import test from 'node:test'
import { isEspressoExtractionSnapshot } from '../src/features/brew/liveShotState.ts'

test('keeps an active shot alive while Decaid reports the skip-step transition', () => {
  assert.equal(isEspressoExtractionSnapshot({ state: { state: 'skipStep', substate: 'pouring' } }, true), true)
})

test('does not let an isolated skip-step snapshot start a new shot', () => {
  assert.equal(isEspressoExtractionSnapshot({ state: { state: 'skipStep', substate: 'pouring' } }), false)
})

test('continues to end a shot for a genuine idle snapshot', () => {
  assert.equal(isEspressoExtractionSnapshot({ state: { state: 'idle', substate: 'idle' } }, true), false)
})

test('recognizes normal espresso extraction snapshots', () => {
  assert.equal(isEspressoExtractionSnapshot({ state: { state: 'espresso', substate: 'pouring' } }), true)
})

test('treats espresso to skip-step to the next espresso frame as one uninterrupted shot', () => {
  let shotInProgress = false
  let completedShots = 0
  const snapshots = [
    { state: { state: 'espresso', substate: 'pouring' }, profileFrame: 2 },
    { state: { state: 'skipStep', substate: 'pouring' }, profileFrame: 2 },
    { state: { state: 'espresso', substate: 'pouring' }, profileFrame: 3 },
  ]

  for (const snapshot of snapshots) {
    const isLiveShot = isEspressoExtractionSnapshot(snapshot, shotInProgress)
    if (shotInProgress && !isLiveShot) completedShots += 1
    shotInProgress = isLiveShot
  }

  assert.equal(shotInProgress, true)
  assert.equal(completedShots, 0)
  assert.equal(snapshots.at(-1)?.profileFrame, 3)
})
