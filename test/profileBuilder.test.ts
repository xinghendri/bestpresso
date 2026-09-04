import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { builderTargetPoints, createDefaultProfileDraft, nextBuilderStage, stageConstraintLabel } from '../src/features/profiles/profileBuilderModel.ts'

const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const screen = readFileSync(new URL('../src/features/profiles/ProfileBuilderScreen.tsx', import.meta.url), 'utf8')
const styles = readFileSync(new URL('../src/styles/index.css', import.meta.url), 'utf8')

test('routes profile creation into an isolated builder screen', () => {
  assert.match(app, /'profile-builder'/)
  assert.match(app, /<ProfileBuilderScreen/)
  assert.match(app, /onAddProfile=\{\(\) => navigate\('profile-builder'\)\}/)
})

test('default draft mirrors the Streamline new-profile template', () => {
  const draft = createDefaultProfileDraft()
  assert.equal(draft.title, 'New Profile')
  assert.equal(draft.targetWeight, 0)
  assert.equal(draft.targetVolume, 0)
  assert.equal(draft.targetVolumeCountStart, 0)
  assert.equal(draft.tankTemperature, 0)
  assert.deepEqual(draft.stages.map(({ id: _id, ...stage }) => stage), [
    { name: 'Preinfusion', pump: 'flow', transition: 'fast', target: 2, temperature: 93, sensor: 'coffee', seconds: 10, weight: 0, volume: 0, exit: { type: 'pressure', condition: 'over', value: 4 }, limiter: { type: 'pressure', value: 4, range: 0.6 } },
    { name: 'Ramp', pump: 'flow', transition: 'fast', target: 6, temperature: 93, sensor: 'coffee', seconds: 20, weight: 0, volume: 0, exit: { type: 'pressure', condition: 'over', value: 9 }, limiter: { type: 'pressure', value: 9, range: 0.6 } },
    { name: 'Extraction', pump: 'pressure', transition: 'fast', target: 9, temperature: 93, sensor: 'coffee', seconds: 40, weight: 37, volume: 0 },
  ])
  assert.match(stageConstraintLabel(draft.stages[0]), /pressure/i)
  assert.ok(builderTargetPoints(draft.stages).length > draft.stages.length)
})

test('newly added stages use the Streamline add-step template', () => {
  const stage = nextBuilderStage(3)
  assert.deepEqual({ ...stage, id: 'ignored' }, {
    id: 'ignored',
    name: 'New Step',
    pump: 'flow',
    transition: 'fast',
    target: 6,
    temperature: 93,
    sensor: 'coffee',
    seconds: 30,
    weight: 0,
    volume: 0,
    exit: { type: 'pressure', condition: 'over', value: 9 },
  })
})

test('builder target points stay chronological across smooth and fast stages', () => {
  const draft = createDefaultProfileDraft()
  const points = builderTargetPoints(draft.stages)
  for (let index = 1; index < points.length; index += 1) {
    assert.ok(points[index].elapsedMs >= points[index - 1].elapsedMs)
  }
  assert.equal(points.at(-1)?.elapsedMs, draft.stages.reduce((total, stage) => total + stage.seconds * 1000, 0))
  assert.equal(points.at(-1)?.temperature, draft.stages.at(-1)?.temperature)
})

test('editor follows the designed high-level hierarchy without prototype-only fields', () => {
  assert.match(screen, /Move to next stage if/)
  assert.match(screen, /Target yield/)
  assert.match(screen, /Measure from/)
  assert.match(screen, /Category \(optional\)/)
  assert.doesNotMatch(screen, /Prototype only/)
  assert.doesNotMatch(screen, /Volume fallback/)
  assert.match(screen, /aria-label="Add stage"/)
  assert.match(screen, /nextBuilderStage/)
})

test('stage controls remain reachable and compact on short landscape screens', () => {
  assert.match(styles, /profile-builder-screen\.pb-screen\{[^}]*overflow-y:auto/)
  assert.match(styles, /@media\(max-height:760px\)[\s\S]*?\.pb-stage,.pb-add-stage\{height:430px/)
  assert.match(styles, /@media\(max-height:760px\)[\s\S]*?\.pb-stage\{[^}]*flex-basis:390px/)
  assert.match(styles, /@media\(max-height:760px\)[\s\S]*?\.pb-stepper>span\{font-size:18px/)
})

test('builder chart uses the established profile colors and includes temperature', () => {
  assert.match(styles, /\.pb-chart__line--flow\{stroke:#5ba7ea\}/)
  assert.match(styles, /\.pb-chart__line--pressure\{stroke:#53d68e\}/)
  assert.match(styles, /\.pb-chart__line--temperature\{stroke:#d65353\}/)
  assert.match(screen, /temperaturePath/)
})

test('stage strip leaves horizontal and vertical drags to native axis locking', () => {
  assert.match(styles, /\.pb-stage-strip\{[^}]*overflow-x:auto[^}]*overflow-y:hidden/)
  assert.match(styles, /\.pb-stage-strip\{[^}]*overscroll-behavior-x:contain[^}]*overscroll-behavior-y:auto/)
  assert.match(styles, /\.pb-stage-strip\{[^}]*touch-action:pan-x pan-y/)
})
