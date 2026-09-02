import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { BESTPRESSO_TARGET_YIELD_OVERRIDE_KEY, profileConfiguredTargetYield, profileTargetYield, profileUserTargetNeedsWorkflowSync, profileUsesStopAtWeight, workflowValuesForProfile } from '../src/api/decaid/profileWorkflow.ts'
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

const brewingPanel = readFileSync(new URL('../src/features/brew/BrewingPanel.tsx', import.meta.url), 'utf8')
const brewingData = readFileSync(new URL('../src/features/brew/useBrewingData.ts', import.meta.url), 'utf8')
const adapters = readFileSync(new URL('../src/api/decaid/adapters.ts', import.meta.url), 'utf8')

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

test('saving a yield creates an explicit override for a profile without a programmed yield', () => {
  const values = workflowValuesForProfile(record(null), domainProfile('42'))
  assert.equal(values.patch.profile?.target_weight, 42)
  assert.equal(values.patch.context?.targetYield, 42)
  assert.equal(values.metadata.targetYield, 42)
  assert.equal(values.metadata[BESTPRESSO_TARGET_YIELD_OVERRIDE_KEY], 42)
})

test('saving zero disables brew by weight and persists that choice', () => {
  const values = workflowValuesForProfile(record(40), domainProfile('0'))
  assert.equal(values.patch.profile?.target_weight, null)
  assert.equal(values.patch.context?.targetYield, null)
  assert.equal(values.metadata.targetYield, null)
  assert.equal(values.metadata[BESTPRESSO_TARGET_YIELD_OVERRIDE_KEY], 0)
})

test('a saved zero keeps brew by weight disabled when the profile is selected again', () => {
  const disabledRecord = record(40)
  disabledRecord.metadata = {
    targetYield: null,
    [BESTPRESSO_TARGET_YIELD_OVERRIDE_KEY]: 0,
  }
  const values = workflowValuesForProfile(disabledRecord, domainProfile('—'))
  assert.equal(values.patch.profile?.target_weight, null)
  assert.equal(values.patch.context?.targetYield, null)
  assert.equal(values.metadata[BESTPRESSO_TARGET_YIELD_OVERRIDE_KEY], 0)
})

test('only an explicit Bestpresso override revives a profile without a programmed yield', () => {
  assert.equal(profileConfiguredTargetYield(record(null).profile, { targetYield: 36 }), undefined)
  assert.equal(profileConfiguredTargetYield(record(null).profile, { targetYield: 42, [BESTPRESSO_TARGET_YIELD_OVERRIDE_KEY]: 42 }), 42)
  assert.equal(profileConfiguredTargetYield(record(40).profile, { targetYield: 42 }), 42)
  assert.equal(profileConfiguredTargetYield(record(40).profile, { targetYield: null, [BESTPRESSO_TARGET_YIELD_OVERRIDE_KEY]: 0 }), undefined)
  assert.equal(profileConfiguredTargetYield(record(40).profile, { targetYield: null, [BESTPRESSO_TARGET_YIELD_OVERRIDE_KEY]: 0 }, 40), undefined)
})

test('restores the saved user yield when the current workflow lost it', () => {
  const metadata = { [BESTPRESSO_TARGET_YIELD_OVERRIDE_KEY]: 42 }
  assert.equal(profileUserTargetNeedsWorkflowSync(metadata, null), true)
  assert.equal(profileUserTargetNeedsWorkflowSync(metadata, 36), true)
  assert.equal(profileUserTargetNeedsWorkflowSync(metadata, 42), false)
  assert.equal(profileUserTargetNeedsWorkflowSync({}, 42), false)
  assert.equal(profileUserTargetNeedsWorkflowSync({ [BESTPRESSO_TARGET_YIELD_OVERRIDE_KEY]: 0 }, 42), true)
  assert.equal(profileUserTargetNeedsWorkflowSync({ [BESTPRESSO_TARGET_YIELD_OVERRIDE_KEY]: 0 }, null), false)
  assert.match(brewingData, /profileUserTargetNeedsWorkflowSync\(restoredRecord\?\.metadata, workflow\.context\?\.targetYield\)/)
})

test('yield remains visible and editable when its current value is unset', () => {
  assert.doesNotMatch(brewingPanel, /hasTargetYield/)
  assert.match(brewingPanel, /<Metric metric=\{\{ label: 'Yield', value: activeProfile\.targetYield[^\n]+reserveSubtext/)
  assert.match(adapters, /targetYield: numberString\(profileConfiguredTargetYield\(profile, metadata,/)
  assert.doesNotMatch(brewingData, /does not use stop at weight/)
})

test('profile display has no target yield when stop at weight is disabled', () => {
  assert.equal(profileTargetYield(record(null).profile), undefined)
  assert.equal(profileTargetYield(record().profile), undefined)
  assert.equal(profileTargetYield(record(null).profile, 36), undefined)
  assert.equal(profileTargetYield(record(40).profile), 40)
  assert.equal(profileTargetYield(record(40).profile, 42), 42)
})
