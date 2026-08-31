import assert from 'node:assert/strict'
import test from 'node:test'
import { liveShotYield } from '../src/domain/brewing.ts'

test('uses the independently streamed scale weight for live shot yield', () => {
  assert.equal(liveShotYield(36.4, [{ weight: 34.8 }]), 36.4)
})

test('falls back to the latest machine-frame sample without a scale stream', () => {
  assert.equal(liveShotYield(undefined, [{ weight: 18.2 }, { weight: 35.9 }]), 35.9)
})
