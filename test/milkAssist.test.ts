import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_MILK_ASSIST, MILK_PRESENCE_THRESHOLD_G, clampSteamDuration, liveSuggestion, normalizeMilkAssist, ratePer150Ml, stableWeight, suggestedSteamSeconds, wizardAdjustCapturedSeconds, wizardCaptureJug, wizardCaptureMilk, wizardInit, wizardSteamEvent } from '../src/features/machine/milkAssist.ts'

test('suggested seconds scale linearly, round, and clamp to 10-120', () => {
  assert.equal(suggestedSteamSeconds(214, 150, 18), 26)
  assert.equal(suggestedSteamSeconds(150, 150, 18), 18)
  assert.equal(suggestedSteamSeconds(20, 150, 18), 10)
  assert.equal(suggestedSteamSeconds(2000, 150, 18), 120)
  assert.equal(suggestedSteamSeconds(214, null, 18), null)
  assert.equal(suggestedSteamSeconds(214, 150, null), null)
  assert.equal(suggestedSteamSeconds(214, 0, 18), null)
})

test('rate derives the per-150ml seconds for display', () => {
  assert.equal(ratePer150Ml(214, 24), 17)
})

test('live suggestion needs a connected scale, calibration, and milk above the jug threshold', () => {
  const base = { scaleConnected: true, scaleGrams: 626.4, jugGrams: 412, calGrams: 214, calSeconds: 24 }
  assert.deepEqual(liveSuggestion(base), { milkGrams: 214.4, seconds: 24 })
  assert.equal(liveSuggestion({ ...base, scaleConnected: false }), null)
  assert.equal(liveSuggestion({ ...base, scaleGrams: undefined }), null)
  assert.equal(liveSuggestion({ ...base, jugGrams: null }), null)
  assert.equal(liveSuggestion({ ...base, calGrams: null }), null)
  assert.equal(liveSuggestion({ ...base, calSeconds: null }), null)
  assert.equal(liveSuggestion({ ...base, scaleGrams: 412 + MILK_PRESENCE_THRESHOLD_G }), null)
})

test('store normalization keeps valid values and rejects the rest', () => {
  assert.deepEqual(normalizeMilkAssist(undefined), DEFAULT_MILK_ASSIST)
  assert.deepEqual(normalizeMilkAssist('junk'), DEFAULT_MILK_ASSIST)
  const valid = { enabled: true, jugGrams: 412, calGrams: 214, calSeconds: 24, pendingRestoreSeconds: 17 }
  assert.deepEqual(normalizeMilkAssist(valid), valid)
  assert.equal(normalizeMilkAssist({ jugGrams: -5 }).jugGrams, null)
  assert.equal(normalizeMilkAssist({ calGrams: 0 }).calGrams, null)
  assert.equal(normalizeMilkAssist({ calSeconds: 3 }).calSeconds, null)
  assert.equal(normalizeMilkAssist({ calSeconds: 500 }).calSeconds, null)
  assert.equal(normalizeMilkAssist({ enabled: 'yes' }).enabled, false)
  assert.equal(normalizeMilkAssist({ jugGrams: 412.6 }).jugGrams, 413)
})

test('wizard always starts at the jug step and walks jug, milk, steam', () => {
  assert.deepEqual(wizardInit(null), { step: 'jug', savedJugGrams: null })
  assert.deepEqual(wizardInit(412), { step: 'jug', savedJugGrams: 412 })
  const milk = wizardCaptureJug(412)
  assert.deepEqual(milk, { step: 'milk', jugGrams: 412 })
  assert.deepEqual(wizardCaptureMilk(milk, 626), { step: 'steam', jugGrams: 412, milkGrams: 214, phase: 'waiting', elapsedSeconds: 0 })
})

test('steam phase times the run, rejects short runs, and caps at 120', () => {
  const steam = wizardCaptureMilk(wizardCaptureJug(412), 626)
  const running = wizardSteamEvent(wizardSteamEvent(steam, { kind: 'started' }), { kind: 'tick', elapsedSeconds: 31.7 })
  assert.equal(running.step === 'steam' && running.phase, 'running')
  assert.deepEqual(wizardSteamEvent(running, { kind: 'ended' }), { step: 'steam', jugGrams: 412, milkGrams: 214, phase: 'captured', elapsedSeconds: 32 })
  const short = wizardSteamEvent(wizardSteamEvent(wizardSteamEvent(steam, { kind: 'started' }), { kind: 'tick', elapsedSeconds: 3 }), { kind: 'ended' })
  assert.equal(short.step === 'steam' && short.phase, 'tooShort')
  const capped = wizardSteamEvent(wizardSteamEvent(steam, { kind: 'started' }), { kind: 'tick', elapsedSeconds: 120 })
  assert.equal(capped.step === 'steam' && capped.phase, 'reachedMax')
  assert.equal(wizardSteamEvent(steam, { kind: 'ended' }), steam)
})

test('captured seconds adjust within calibration bounds and only when captured', () => {
  const captured = wizardSteamEvent(wizardSteamEvent(wizardSteamEvent(wizardCaptureMilk(wizardCaptureJug(412), 626), { kind: 'started' }), { kind: 'tick', elapsedSeconds: 32.2 }), { kind: 'ended' })
  assert.deepEqual(wizardAdjustCapturedSeconds(captured, 24), { step: 'steam', jugGrams: 412, milkGrams: 214, phase: 'captured', elapsedSeconds: 24 })
  assert.equal((wizardAdjustCapturedSeconds(captured, 2) as { elapsedSeconds: number }).elapsedSeconds, 5)
  assert.equal((wizardAdjustCapturedSeconds(captured, 500) as { elapsedSeconds: number }).elapsedSeconds, 120)
  const waiting = wizardCaptureMilk(wizardCaptureJug(412), 626)
  assert.equal(wizardAdjustCapturedSeconds(waiting, 24), waiting)
})

test('stable weight needs 1500ms of samples within one gram of the latest', () => {
  const settled = [{ grams: 412, atMs: 0 }, { grams: 412.4, atMs: 800 }, { grams: 411.8, atMs: 1600 }]
  assert.equal(stableWeight(settled, 1600), 412)
  assert.equal(stableWeight([{ grams: 412, atMs: 1400 }], 1600), null)
  assert.equal(stableWeight([{ grams: 405, atMs: 100 }, { grams: 412, atMs: 1600 }], 1600), null)
  assert.equal(stableWeight([], 1600), null)
})

test('saved steam durations clamp to the protocol range of 10 to 120 s', () => {
  assert.equal(clampSteamDuration(7), 10)
  assert.equal(clampSteamDuration(24.4), 24)
  assert.equal(clampSteamDuration(130), 120)
})

test('any workflow duration survives storage as a pending restore', () => {
  assert.equal(normalizeMilkAssist({ pendingRestoreSeconds: 3 }).pendingRestoreSeconds, 3)
  assert.equal(normalizeMilkAssist({ pendingRestoreSeconds: 120 }).pendingRestoreSeconds, 120)
  assert.equal(normalizeMilkAssist({ pendingRestoreSeconds: 0 }).pendingRestoreSeconds, null)
  assert.equal(normalizeMilkAssist({ pendingRestoreSeconds: 121 }).pendingRestoreSeconds, null)
})
