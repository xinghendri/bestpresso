import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { isSuccessfulEspressoCompletion, shouldPlayCompletionCue } from '../src/features/brew/completionCue.ts'

const brewingData = readFileSync(new URL('../src/features/brew/useBrewingData.ts', import.meta.url), 'utf8')
const completionSound = readFileSync(new URL('../src/audio/completionSound.ts', import.meta.url), 'utf8')

test('loads the compact OGG completion cue', () => {
  assert.match(completionSound, /brew-complete\.ogg/)
  assert.doesNotMatch(completionSound, /brew-complete\.wav/)
})

test('plays the cue for a normally completed cleaning sequence', () => {
  assert.equal(shouldPlayCompletionCue({ kind: 'cleaning', interrupted: false, elapsedMs: 30_000, hasExtraction: false }), true)
})

test('plays the cue for a completed espresso extraction', () => {
  assert.equal(shouldPlayCompletionCue({ kind: 'espresso', interrupted: false, elapsedMs: 30_000, hasExtraction: true }), true)
})

test('does not play the cue for a connection interruption', () => {
  assert.equal(shouldPlayCompletionCue({ kind: 'cleaning', interrupted: true, elapsedMs: 30_000, hasExtraction: false }), false)
  assert.equal(shouldPlayCompletionCue({ kind: 'espresso', interrupted: true, elapsedMs: 30_000, hasExtraction: true }), false)
})

test('keeps valid disconnected espresso data eligible for normal shot finalization', () => {
  assert.equal(isSuccessfulEspressoCompletion(30_000, true), true)
  assert.equal(shouldPlayCompletionCue({ kind: 'espresso', interrupted: true, elapsedMs: 30_000, hasExtraction: true }), false)
})

test('does not play the cue for a short or telemetry-free espresso event', () => {
  assert.equal(shouldPlayCompletionCue({ kind: 'espresso', interrupted: false, elapsedMs: 4_999, hasExtraction: true }), false)
  assert.equal(shouldPlayCompletionCue({ kind: 'espresso', interrupted: false, elapsedMs: 30_000, hasExtraction: false }), false)
})

test('marks connection loss as interrupted while a normal machine transition completes', () => {
  assert.match(brewingData, /else if \(liveShotSession\.current\) \{\s*completeLiveShot\(\)/)
  assert.match(brewingData, /if \(!connected\) \{[\s\S]*?completeLiveShot\(true\)/)
})
