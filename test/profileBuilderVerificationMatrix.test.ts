import assert from 'node:assert/strict'
import test from 'node:test'
import type { DecaidProfile } from '../src/api/decaid/types.ts'
import { profileUsesStopAtWeight, workflowValuesForProfile } from '../src/api/decaid/profileWorkflow.ts'
import { createDefaultProfileDraft, profileDraftFromDecaidProfile, profileDraftToDecaidProfile } from '../src/features/profiles/profileBuilderModel.ts'
import { validateProfileDraft } from '../src/features/profiles/profileBuilderValidation.ts'
import { canonicalProfileForVerification } from '../src/features/profiles/profileSaveVerification.ts'

function roundTrip(profile: DecaidProfile) {
  const draft = profileDraftFromDecaidProfile(profile, { mode: 'edit', copyName: false })
  return { draft, saved: profileDraftToDecaidProfile(draft) }
}

const baseProfile = (overrides: Partial<DecaidProfile> = {}): DecaidProfile => ({
  version: '2.1',
  title: 'Verification profile',
  notes: 'Step 7 matrix',
  author: 'user',
  beverage_type: 'espresso',
  target_weight: 36,
  target_volume: 60,
  target_volume_count_start: 1,
  tank_temperature: 0,
  steps: [{
    name: 'Fill',
    pump: 'flow',
    transition: 'fast',
    flow: 3.5,
    temperature: 93,
    sensor: 'coffee',
    seconds: 12,
    volume: 100,
    weight: 0,
    exit: { type: 'pressure', condition: 'over', value: 4 },
    limiter: { value: 6, range: 0.6 },
  }],
  ...overrides,
})

test('Step 7 matrix: pressure/flow, transitions, sensors, exits, limiters, and stage weight round-trip', () => {
  const profile = baseProfile({
    future_profile_setting: { keep: true },
    steps: [
      {
        name: 'Pressure fast', pump: 'pressure', transition: 'fast', pressure: 8.5,
        temperature: 93, sensor: 'coffee', seconds: 8, volume: 30, weight: 0,
        exit: { type: 'flow', condition: 'under', value: 1.2 }, limiter: { value: 2.4, range: 0.4 },
        future_stage_setting: 'preserved',
      },
      {
        name: 'Flow smooth', pump: 'flow', transition: 'smooth', flow: 2.2,
        temperature: 91.5, sensor: 'water', seconds: 18, volume: 70, weight: 18,
        exit: { type: 'pressure', condition: 'over', value: 7 }, limiter: { value: 8, range: 0.8 },
      },
      {
        name: 'Flow fast under', pump: 'flow', transition: 'fast', flow: 1.4,
        temperature: 90, sensor: 'coffee', seconds: 22, volume: 90, weight: null,
        exit: { type: 'flow', condition: 'under', value: 0.8 }, limiter: { value: 6, range: 0.3 },
      },
      {
        name: 'Pressure smooth over', pump: 'pressure', transition: 'smooth', pressure: 6,
        temperature: 89, sensor: 'water', seconds: 30, volume: 120,
        exit: { type: 'pressure', condition: 'over', value: 5.5 }, limiter: { value: 1.8, range: 0.2 },
      },
    ],
  })
  const { draft, saved } = roundTrip(profile)

  assert.equal(validateProfileDraft(draft).canSave, true)
  assert.deepEqual(canonicalProfileForVerification(saved), canonicalProfileForVerification(profile))
  assert.deepEqual(saved.future_profile_setting, { keep: true })
  assert.equal(saved.steps?.[0].future_stage_setting, 'preserved')
  assert.deepEqual(draft.stages.map((stage) => [stage.pump, stage.transition, stage.sensor]), [
    ['pressure', 'fast', 'coffee'],
    ['flow', 'smooth', 'water'],
    ['flow', 'fast', 'coffee'],
    ['pressure', 'smooth', 'water'],
  ])
  assert.deepEqual(draft.stages.map((stage) => stage.exit?.condition), ['under', 'over', 'under', 'over'])
  assert.deepEqual(draft.stages.map((stage) => stage.limiter?.type), ['flow', 'pressure', 'pressure', 'flow'])
  assert.equal(draft.stages[1].weight, 18)
})

test('Step 7 matrix: whole-shot weight and volume fallback retain their exact counting configuration', () => {
  const profile = baseProfile({ target_weight: 42.5, target_volume: 70, target_volume_count_start: 2, steps: [
    ...baseProfile().steps!,
    { name: 'Ramp', pump: 'pressure', transition: 'smooth', pressure: 9, temperature: 93, sensor: 'coffee', seconds: 10, volume: 50 },
    { name: 'Decline', pump: 'flow', transition: 'smooth', flow: 1.5, temperature: 92, sensor: 'coffee', seconds: 30, volume: 100 },
  ] })
  const { draft, saved } = roundTrip(profile)

  assert.equal(draft.targetWeight, 42.5)
  assert.equal(draft.targetVolume, 70)
  assert.equal(draft.targetVolumeCountStart, 2)
  assert.equal(saved.target_weight, 42.5)
  assert.equal(saved.target_volume, 70)
  assert.equal(saved.target_volume_count_start, 2)
  assert.equal(validateProfileDraft(draft).canSave, true)
})

test('Step 7 matrix: Filter3-style no-yield profiles remain no-yield until the user opts in', () => {
  const profile = baseProfile({
    title: 'Filter3', beverage_type: 'pourover', target_weight: 0, target_volume: 0,
    target_volume_count_start: 2,
    steps: Array.from({ length: 7 }, (_, index) => ({
      name: `Filter ${index + 1}`, pump: 'flow', transition: 'fast', flow: index === 1 ? 0 : 1.1,
      temperature: 94 - index, sensor: 'water', seconds: index === 5 ? 100 : 30, volume: 200,
      weight: 0, limiter: { value: 0, range: 1 },
    })),
  })
  const { draft, saved } = roundTrip(profile)

  assert.equal(profileUsesStopAtWeight(saved), false)
  assert.equal(saved.target_weight, 0)
  assert.equal(validateProfileDraft(draft).canSave, true)

  const workflow = workflowValuesForProfile({ id: 'filter-3', profile: saved }, {
    id: 'filter-3', name: 'Filter3', temperature: '94', grindSetting: '20', dose: '18', targetYield: '—',
  })
  assert.equal(workflow.patch.profile?.target_weight, null)
  assert.equal(workflow.patch.context?.targetYield, null)
})

test('Step 7 matrix: cleaning sequences retain classification, order, and every stage', () => {
  const stages = Array.from({ length: 9 }, (_, index) => ({
    name: index % 2 === 0 ? `Pressure rise ${Math.floor(index / 2) + 1}` : `Pause ${Math.ceil(index / 2)}`,
    pump: 'pressure' as const,
    transition: 'fast' as const,
    pressure: index % 2 === 0 ? 10 : -5.717648576819556e-15,
    temperature: 85,
    sensor: 'coffee' as const,
    seconds: index === 0 ? 20 : 15,
    volume: 500,
    weight: 0,
    limiter: { value: 0, range: 0.6 },
  }))
  const profile = baseProfile({ title: 'Cleaning / Forward Flush x5', beverage_type: 'cleaning', target_weight: 0, target_volume: 0, target_volume_count_start: 2, steps: stages })
  const { draft, saved } = roundTrip(profile)

  assert.equal(draft.beverageType, 'cleaning')
  assert.equal(saved.beverage_type, 'cleaning')
  assert.deepEqual(saved.steps?.map((stage) => stage.name), stages.map((stage) => stage.name))
  assert.equal(saved.steps?.length, 9)
  assert.equal(saved.steps?.[1].pressure, 0)
  assert.equal(validateProfileDraft(draft).canSave, true)
})

test('Step 7 matrix: a 20-stage adaptive profile stays ordered and within Decaid limits', () => {
  const steps = Array.from({ length: 20 }, (_, index) => ({
    name: `Adaptive ${index + 1}`,
    pump: index % 2 === 0 ? 'flow' as const : 'pressure' as const,
    transition: index % 3 === 0 ? 'smooth' as const : 'fast' as const,
    ...(index % 2 === 0 ? { flow: Math.max(0.5, 3.5 - index * 0.1) } : { pressure: Math.max(4, 9 - index * 0.15) }),
    temperature: 92 - index * 0.1,
    sensor: 'coffee' as const,
    seconds: index === 19 ? 127 : 10 + index,
    volume: 100,
    weight: 0,
    ...(index % 2 === 0 ? { exit: { type: 'pressure' as const, condition: 'over' as const, value: 4 + index * 0.1 } } : {}),
  }))
  const profile = baseProfile({ title: 'Adaptive 20-stage', target_weight: 0, target_volume: 0, target_volume_count_start: 2, steps })
  const { draft, saved } = roundTrip(profile)

  assert.equal(draft.stages.length, 20)
  assert.equal(validateProfileDraft(draft).canSave, true)
  assert.deepEqual(saved.steps?.map((stage) => stage.name), steps.map((stage) => stage.name))
  assert.deepEqual(canonicalProfileForVerification(saved), canonicalProfileForVerification(profile))
})

test('Step 7 matrix: protected profiles copy while user-owned profiles retain overwrite identity', () => {
  const protectedDraft = profileDraftFromDecaidProfile(baseProfile({ title: 'Bundled profile' }), {
    mode: 'edit', sourceProfileId: 'profile:bundled', existingTitles: ['Bundled profile'], copyName: true,
  })
  const userDraft = profileDraftFromDecaidProfile(baseProfile({ title: 'My profile' }), {
    mode: 'edit', sourceProfileId: 'profile:user', existingTitles: ['My profile'], copyName: false,
  })

  assert.equal(protectedDraft.title, 'Bundled profile (01)')
  assert.equal(userDraft.title, 'My profile')
  assert.equal(protectedDraft.sourceProfileId, 'profile:bundled')
  assert.equal(userDraft.sourceProfileId, 'profile:user')
})

test('Step 7 matrix: invalid drafts are blocked and advisory warnings remain saveable', () => {
  const invalid = createDefaultProfileDraft()
  invalid.title = ''
  invalid.stages[0].seconds = 128
  invalid.stages[1].limiter = { type: 'flow', value: 2, range: undefined }
  assert.equal(validateProfileDraft(invalid).canSave, false)

  const advisory = createDefaultProfileDraft()
  advisory.targetWeight = 0
  advisory.targetVolume = 0
  advisory.stages[2].weight = 36
  const warningResult = validateProfileDraft(advisory)
  assert.equal(warningResult.canSave, true)
  assert.ok(warningResult.warnings.some((issue) => issue.id === 'profile-no-final-target'))
  assert.equal(warningResult.warnings.some((issue) => issue.id.endsWith('weight-scale')), false)
})
