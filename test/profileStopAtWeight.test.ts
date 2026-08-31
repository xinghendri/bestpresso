import assert from 'node:assert/strict'
import test from 'node:test'
import { profileTargetYield, profileUsesStopAtWeight, workflowValuesForProfile } from '../src/api/decaid/profileWorkflow.ts'
import type { DecaidProfileRecord } from '../src/api/decaid/types.ts'
import type { BrewProfile } from '../src/domain/brewing.ts'

const domainProfile = (targetYield: string): BrewProfile => ({
  id: 'filter-3',
  name: 'Filter 3',
  temperature: '92',
  grindSetting: '20',
  dose: '18',
  targetYield,
})

const record = (targetWeight?: number | null): DecaidProfileRecord => ({
  id: 'filter-3',
  profile: {
    title: 'Filter 3',
    target_weight: targetWeight,
    steps: [{ name: 'Pour', temperature: 92, flow: 3 }],
  },
  metadata: { targetYield: 36 },
})

test('a profile target weight is the sole stop-at-weight authority', () => {
  assert.equal(profileUsesStopAtWeight(record(40).profile), true)
  assert.equal(profileUsesStopAtWeight(record(null).profile), false)
  assert.equal(profileUsesStopAtWeight(record().profile), false)
})

test('selecting a profile without stop at weight clears inherited yield targets', () => {
  const values = workflowValuesForProfile(record(null), domainProfile('—'))
  assert.equal(values.patch.profile?.target_weight, null)
  assert.equal(values.patch.context?.targetYield, null)
  assert.equal(values.metadata.targetYield, null)
})

test('selecting a stop-at-weight profile preserves its configured target', () => {
  const values = workflowValuesForProfile(record(40), domainProfile('42'))
  assert.equal(values.patch.profile?.target_weight, 42)
  assert.equal(values.patch.context?.targetYield, 42)
  assert.equal(values.metadata.targetYield, 42)
})

test('profile display has no target yield when stop at weight is disabled', () => {
  assert.equal(profileTargetYield(record(null).profile), undefined)
  assert.equal(profileTargetYield(record().profile), undefined)
  assert.equal(profileTargetYield(record(null).profile, 36), undefined)
  assert.equal(profileTargetYield(record(40).profile), 40)
  assert.equal(profileTargetYield(record(40).profile, 42), 42)
})
