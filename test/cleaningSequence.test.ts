import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { CLEANING_PROFILE_START_STATE, cleaningRestorePatch, isCleaningSequenceRun, prepareCleaningProfileForEspressoStart, profileForCleaningShortcut } from '../src/features/cleaning/cleaningSequence.ts'

const picker = readFileSync(new URL('../src/features/cleaning/CleaningSequencePicker.tsx', import.meta.url), 'utf8')
const brewingData = readFileSync(new URL('../src/features/brew/useBrewingData.ts', import.meta.url), 'utf8')

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

test('selects the cleaning workflow before awaiting the final machine upload', async () => {
  const requestedProfile = {
    title: 'Cleaning/Forward Flush x5',
    beverage_type: 'cleaning',
    steps: [{ name: 'Fill', flow: 6 }],
  }
  const selectedProfile = { ...requestedProfile, notes: 'Selected by Decaid' }
  const events: string[] = []

  const workflow = await prepareCleaningProfileForEspressoStart(requestedProfile, {
    selectWorkflow: async () => {
      events.push('select workflow')
      return { profile: selectedProfile }
    },
    uploadProfile: async (profile) => {
      events.push('upload selected profile')
      assert.equal(profile, selectedProfile)
    },
  })

  assert.deepEqual(events, ['select workflow', 'upload selected profile'])
  assert.equal(workflow.profile, selectedProfile)
})

test('does not upload a workflow that did not retain the cleaning selection', async () => {
  let uploadCalled = false
  await assert.rejects(() => prepareCleaningProfileForEspressoStart({
    title: 'Cleaning/Forward Flush x5',
    beverage_type: 'cleaning',
    steps: [{ name: 'Fill', flow: 6 }],
  }, {
    selectWorkflow: async () => ({ profile: { title: 'Adaptive V2', beverage_type: 'espresso' } }),
    uploadProfile: async () => { uploadCalled = true },
  }))
  assert.equal(uploadCalled, false)
})

test('restores only profile selection and never rewrites current utility settings', () => {
  const workflow = {
    profile: { title: 'Adaptive V2', steps: [{ name: 'Fill' }] },
    context: { targetDoseWeight: 18, targetYield: 36 },
    rinseData: { targetTemperature: 92, duration: 5, flow: 6 },
    steamSettings: { targetTemperature: 160, duration: 50, flow: 1 },
    hotWaterData: { targetTemperature: 80, duration: 30, volume: 150, flow: 4 },
  }

  assert.deepEqual(cleaningRestorePatch(workflow), {
    profile: workflow.profile,
    context: workflow.context,
  })
})

test('keeps the cup action available after selection without relying on a prepared-prop render', () => {
  assert.match(picker, /disabled=\{!selectedProfileId \|\| interactionLocked\}/)
  assert.doesNotMatch(picker, /preparedProfileId !== selectedProfileId \|\| interactionLocked/)
})

test('prepares the selected cleaning profile inside the start path when needed', () => {
  assert.match(brewingData, /if \(pendingCleaningSequence\.current\?\.profileId !== profileId\) \{\s*const prepared = await prepareCleaningSequence\(profileId\)\s*if \(!prepared\) return false/)
  assert.doesNotMatch(brewingData, /cleaningPreparedProfileId !== profileId/)
})

test('uses the Espresso request without a stale frontend connection gate', () => {
  const startPath = brewingData.slice(
    brewingData.indexOf('const startCleaningSequence'),
    brewingData.indexOf('const cancelCleaningSequence'),
  )
  assert.match(startPath, /await setMachineState\(CLEANING_PROFILE_START_STATE\)/)
  assert.doesNotMatch(startPath, /connection !== 'connected'/)
  assert.doesNotMatch(startPath, /machineConnection !== 'connected'/)
})
