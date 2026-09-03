import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { builderTargetPoints, createDefaultProfileDraft, stageConstraintLabel } from '../src/features/profiles/profileBuilderModel.ts'

const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const screen = readFileSync(new URL('../src/features/profiles/ProfileBuilderScreen.tsx', import.meta.url), 'utf8')

test('routes profile creation into an isolated builder screen', () => {
  assert.match(app, /'profile-builder'/)
  assert.match(app, /<ProfileBuilderScreen/)
  assert.match(app, /onAddProfile=\{\(\) => navigate\('profile-builder'\)\}/)
})

test('default draft demonstrates pressure, flow, exits, and opposite-axis limiters', () => {
  const draft = createDefaultProfileDraft()
  assert.equal(draft.stages.length, 4)
  assert.ok(draft.stages.some((stage) => stage.pump === 'flow' && stage.exit?.type === 'pressure'))
  assert.ok(draft.stages.some((stage) => stage.pump === 'pressure' && stage.limiter?.type === 'flow'))
  assert.match(stageConstraintLabel(draft.stages[0]), /pressure/i)
  assert.ok(builderTargetPoints(draft.stages).length > draft.stages.length)
})

test('builder target points stay chronological across smooth and fast stages', () => {
  const draft = createDefaultProfileDraft()
  const points = builderTargetPoints(draft.stages)
  for (let index = 1; index < points.length; index += 1) {
    assert.ok(points[index].elapsedMs >= points[index - 1].elapsedMs)
  }
  assert.equal(points.at(-1)?.elapsedMs, draft.stages.reduce((total, stage) => total + stage.seconds * 1000, 0))
})

test('editor distinguishes stage advancement from whole-shot stopping', () => {
  assert.match(screen, /Advance this stage/)
  assert.match(screen, /Whole-shot stop/)
  assert.match(screen, /Scale weight advances this stage only/)
  assert.match(screen, /Prototype only — nothing is uploaded/)
})
