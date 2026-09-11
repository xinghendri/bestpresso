import assert from 'node:assert/strict'
import test from 'node:test'
import { homeSettingValue } from '../src/features/settings/homeSettingValue.ts'

test('homescreen fallback preserves numbers and zero without inventing unavailable values', () => {
  const utility = { id: 'steam' as const, label: 'Steam', metrics: [
    { label: 'Target', value: '160' }, { label: 'Flow', value: '0.6' },
    { label: 'Duration', value: '0' }, { label: 'Missing', value: '—' },
  ] }
  assert.equal(homeSettingValue(utility, 'Target'), 160)
  assert.equal(homeSettingValue(utility, 'Flow'), 0.6)
  assert.equal(homeSettingValue(utility, 'Duration'), 0)
  assert.equal(homeSettingValue(utility, 'Missing'), undefined)
  assert.equal(homeSettingValue(utility, 'Unknown'), undefined)
  assert.equal(homeSettingValue(undefined, 'Target'), undefined)
})
