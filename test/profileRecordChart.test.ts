import assert from 'node:assert/strict'
import test from 'node:test'
import { profileRecordsToDomain, profileStepsToTargetPoints } from '../src/api/decaid/adapters.ts'
import type { DecaidProfile, DecaidProfileRecord, DecaidWorkflow } from '../src/api/decaid/types.ts'

const storedProfile: DecaidProfile = {
  title: 'Tea portafilter/Tea Concentrate',
  beverage_type: 'espresso',
  target_weight: 80,
  target_volume_count_start: 1,
  tank_temperature: 0,
  steps: [
    { name: 'Fill', pump: 'flow', transition: 'fast', flow: 4, temperature: 105, seconds: 20, volume: 500 },
    { name: 'Infuse', pump: 'pressure', transition: 'fast', pressure: 0.1, temperature: 105, seconds: 60, volume: 500 },
    { name: 'Flush', pump: 'flow', transition: 'fast', flow: 4, temperature: 105, seconds: 12, volume: 500 },
    { name: 'Infuse', pump: 'pressure', transition: 'fast', pressure: 0.1, temperature: 105, seconds: 70, volume: 500 },
  ],
}

test('profile cards and details use the stored profile stages even when the active workflow has the same title', () => {
  const record: DecaidProfileRecord = { id: 'tea-concentrate', profile: storedProfile, visibility: 'visible' }
  const workflow: DecaidWorkflow = {
    profile: {
      ...storedProfile,
      steps: [
        { name: 'Runtime summary', pump: 'flow', transition: 'fast', flow: 4, limiter: { value: 0.1, range: 0.6 }, temperature: 96, seconds: 162, volume: 500 },
      ],
    },
  }

  const [profile] = profileRecordsToDomain([record], workflow, [])

  assert.deepEqual(profile.targetPoints, profileStepsToTargetPoints(storedProfile.steps))
  assert.deepEqual(profile.stepNames, ['Fill', 'Infuse', 'Flush', 'Infuse'])
  assert.equal(profile.temperature, '96')
  assert.equal(profile.targetPoints?.at(-1)?.elapsedMs, 162_000)
  assert.ok(new Set(profile.targetPoints?.map((point) => point.flow)).size > 1)
  assert.ok(new Set(profile.targetPoints?.map((point) => point.pressure)).size > 1)
})

test('active workflow stages remain a fallback when a profile record has no stages', () => {
  const workflowProfile: DecaidProfile = {
    ...storedProfile,
    steps: [{ name: 'Only available stage', pump: 'pressure', transition: 'fast', pressure: 6, temperature: 93, seconds: 10, volume: 100 }],
  }
  const record: DecaidProfileRecord = {
    id: 'incomplete-record',
    visibility: 'visible',
    profile: { ...storedProfile, steps: undefined },
  }

  const [profile] = profileRecordsToDomain([record], { profile: workflowProfile }, [])

  assert.deepEqual(profile.targetPoints, profileStepsToTargetPoints(workflowProfile.steps))
  assert.deepEqual(profile.stepNames, ['Only available stage'])
})
