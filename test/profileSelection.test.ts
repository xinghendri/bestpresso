import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeRememberedProfileId, resolveRememberedProfileId } from '../src/features/profiles/profileSelectionPersistence.ts'

test('normalizes a persisted profile id', () => {
  assert.equal(normalizeRememberedProfileId('  profile-2  '), 'profile-2')
  assert.equal(normalizeRememberedProfileId(''), null)
  assert.equal(normalizeRememberedProfileId({ id: 'profile-2' }), null)
})

test('restores a remembered profile only while it remains available', () => {
  const available = ['profile-1', 'profile-2']
  assert.equal(resolveRememberedProfileId(available, 'profile-2', 'profile-1'), 'profile-2')
  assert.equal(resolveRememberedProfileId(available, 'deleted-profile', 'profile-1'), 'profile-1')
  assert.equal(resolveRememberedProfileId(available, null, 'profile-1'), 'profile-1')
})
