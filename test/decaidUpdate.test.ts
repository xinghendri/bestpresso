import assert from 'node:assert/strict'
import test from 'node:test'
import { isUpdateState, shouldPresentUpdate, updateProgressPercent, type DecaidUpdateState } from '../src/features/updates/decaidUpdate.ts'

const available: DecaidUpdateState = {
  phase: 'available',
  currentVersion: '0.9.0',
  latestVersion: '0.10.0',
  releaseUrl: 'https://example.com/releases/0.10.0',
  installable: true,
}

test('presents an available Decaid update unless that version was dismissed this session', () => {
  assert.equal(shouldPresentUpdate(available, null), true)
  assert.equal(shouldPresentUpdate(available, '0.9.9'), true)
  assert.equal(shouldPresentUpdate(available, '0.10.0'), false)
})

test('keeps the update visible throughout download and installation', () => {
  assert.equal(shouldPresentUpdate({ ...available, phase: 'downloading' }, null), true)
  assert.equal(shouldPresentUpdate({ ...available, phase: 'installing' }, null), true)
  assert.equal(shouldPresentUpdate({ ...available, phase: 'idle' }, null), false)
  assert.equal(shouldPresentUpdate({ ...available, phase: 'checking' }, null), false)
})

test('recognizes update state separately from command errors', () => {
  assert.equal(isUpdateState(available), true)
  assert.equal(isUpdateState({ error: 'Not supported', url: 'https://example.com' }), false)
})

test('clamps Decaid download progress for display', () => {
  assert.equal(updateProgressPercent(0.427), 43)
  assert.equal(updateProgressPercent(-1), 0)
  assert.equal(updateProgressPercent(2), 100)
  assert.equal(updateProgressPercent(Number.NaN), 0)
})
