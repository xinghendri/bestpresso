import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { builderTargetPoints, createDefaultProfileDraft, nextBuilderStage, profileDraftFromDecaidProfile, profileDraftToDecaidProfile, profileMaximumDurationMs, stageConstraintLabel } from '../src/features/profiles/profileBuilderModel.ts'

const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const profilesPanel = readFileSync(new URL('../src/features/profiles/ProfilesPanel.tsx', import.meta.url), 'utf8')
const screen = readFileSync(new URL('../src/features/profiles/ProfileBuilderScreen.tsx', import.meta.url), 'utf8')
const styles = readFileSync(new URL('../src/styles/index.css', import.meta.url), 'utf8')

test('keeps the unfinished profile builder inaccessible from the application routes', () => {
  assert.doesNotMatch(app, /'profile-builder'/)
  assert.doesNotMatch(app, /<ProfileBuilderScreen/)
  assert.match(profilesPanel, /const PROFILE_CREATION_DEMO_ENABLED = false/)
  assert.match(profilesPanel, /const PROFILE_EDITING_ENABLED = false/)
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

test('editing creates a uniquely named copy and preloads every Decaid execution field', () => {
  const profile = {
    version: '2.1',
    title: 'D-Flow / Adaptive V2',
    notes: 'Keep these notes',
    author: 'Decent',
    beverage_type: 'espresso',
    target_weight: 42,
    target_volume: 55,
    target_volume_count_start: 1,
    tank_temperature: 0,
    future_field: 'preserve me',
    steps: [{
      name: 'Fill', pump: 'flow', transition: 'smooth', flow: 3.2, temperature: 92.5, sensor: 'water', seconds: 12, volume: 14, weight: null,
      exit: { type: 'pressure', condition: 'over', value: 4 }, limiter: { value: 8, range: 0.6 }, future_step_field: 17,
    }],
  } as const
  const draft = profileDraftFromDecaidProfile(profile, {
    mode: 'edit',
    sourceProfileId: 'adaptive',
    sourceMetadata: { description: 'Original metadata' },
    existingTitles: ['D-Flow / Adaptive V2', 'D-Flow / Adaptive V2 (01)'],
  })
  assert.equal(draft.title, 'Adaptive V2 (02)')
  assert.equal(draft.category, 'D-Flow')
  assert.equal(draft.sourceProfileId, 'adaptive')
  assert.deepEqual(draft.sourceMetadata, { description: 'Original metadata' })
  assert.deepEqual({ ...draft.stages[0], id: 'ignored', source: undefined }, {
    id: 'ignored', name: 'Fill', pump: 'flow', transition: 'smooth', target: 3.2, temperature: 92.5, sensor: 'water', seconds: 12, volume: 14, weight: null,
    exit: { type: 'pressure', condition: 'over', value: 4 }, limiter: { type: 'pressure', value: 8, range: 0.6 }, source: undefined,
  })

  const saved = profileDraftToDecaidProfile(draft)
  assert.equal(saved.title, 'D-Flow / Adaptive V2 (02)')
  assert.equal(saved.future_field, 'preserve me')
  assert.equal(saved.steps?.[0].future_step_field, 17)
  assert.deepEqual(saved.steps?.[0].limiter, { value: 8, range: 0.6 })
  assert.equal(saved.steps?.[0].weight, null)
})

test('imported profiles use the same lossless draft mapper', () => {
  const draft = profileDraftFromDecaidProfile({
    title: 'Imported', beverage_type: 'cleaning', target_volume_count_start: 0, tank_temperature: 0,
    steps: [{ name: 'Flush', pump: 'pressure', pressure: 9, transition: 'fast', temperature: 90, sensor: 'coffee', seconds: 5, volume: 0 }],
  }, { mode: 'import', existingTitles: ['Imported'] })
  assert.equal(draft.title, 'Imported (01)')
  assert.equal(draft.beverageType, 'cleaning')
  assert.equal(draft.stages[0].pump, 'pressure')
  assert.equal(draft.stages[0].target, 9)
})

test('builder target points stay chronological across smooth and fast stages', () => {
  const draft = createDefaultProfileDraft()
  const points = builderTargetPoints(draft.stages)
  for (let index = 1; index < points.length; index += 1) {
    assert.ok(points[index].elapsedMs >= points[index - 1].elapsedMs)
  }
  assert.equal(points.at(-1)?.elapsedMs, profileMaximumDurationMs(draft.stages))
  assert.equal(points.at(-1)?.temperature, draft.stages.at(-1)?.temperature)
})

test('builder chart duration is the exact sum of stage maximum times', () => {
  const draft = createDefaultProfileDraft()
  assert.equal(profileMaximumDurationMs(draft.stages), 70_000)

  draft.stages[0].seconds = 7
  draft.stages[1].seconds = 13
  draft.stages[2].seconds = 31

  assert.equal(profileMaximumDurationMs(draft.stages), 51_000)
  assert.equal(builderTargetPoints(draft.stages).at(-1)?.elapsedMs, 51_000)
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

test('stage controls use one height and compact together on short landscape screens', () => {
  assert.match(styles, /profile-builder-screen\.pb-screen\{[\s\S]*?height:100dvh[^}]*display:flex[^}]*overflow:hidden/)
  assert.match(styles, /\.pb-chart,\.pb-screen\.has-active-stage \.pb-chart\{height:auto;min-height:118px;flex:1 1 auto\}/)
  assert.match(styles, /\.pb-stage\.is-active\{[^}]*width:clamp\(700px,69vw,820px\)[^}]*flex-basis:clamp\(700px,69vw,820px\)/)
  assert.match(styles, /\.profile-builder-screen\.pb-screen\{--pb-stage-height:320px\}/)
  assert.match(styles, /\.pb-stage,\.pb-add-stage\{height:var\(--pb-stage-height\)\}/)
  assert.match(styles, /@media\(max-height:850px\)\{\.profile-builder-screen\.pb-screen\{--pb-stage-height:290px\}/)
  assert.match(styles, /@media\(max-height:650px\)\{\.profile-builder-screen\.pb-screen\{--pb-stage-height:260px\}/)
  assert.match(styles, /@media\(max-height:850px\)[\s\S]*?--pb-value-size:18px/)
  assert.match(styles, /\.pb-stage__editor-grid\{grid-template-columns:minmax\(230px,1\.05fr\) minmax\(180px,\.82fr\) minmax\(270px,1\.2fr\);grid-template-rows:1fr\}/)
  assert.match(styles, /\.pb-condition-grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/)
})

test('builder chart uses the established profile colors and includes temperature', () => {
  assert.match(styles, /\.pb-chart__line--flow\{stroke:var\(--chart-flow\)\}/)
  assert.match(styles, /\.pb-chart__line--pressure\{stroke:var\(--chart-pressure\)\}/)
  assert.match(styles, /\.pb-chart__line--temperature\{stroke:var\(--chart-temperature\)\}/)
  assert.match(styles, /\.pb-chart\{--pb-plot-origin:36px/)
  assert.match(screen, /<ChartLegend mode="profile" showWeight=\{false\}/)
  assert.match(screen, /<ChartStageMarkers/)
  assert.match(screen, /<span>bar \/ ml\/s<\/span>/)
  assert.match(styles, /\.pb-chart__axis>span\{[^}]*top:7px/)
  assert.match(styles, /\.pb-chart>svg\{[^}]*left:var\(--pb-plot-origin\)[^}]*width:calc\(100% - var\(--pb-plot-origin\)\)/)
  assert.match(screen, /endMs: startMs \+ profileMaximumDurationMs\(\[stage\]\)/)
  assert.match(screen, /const maximumDurationMs = Math\.max\(1, profileMaximumDurationMs\(draft\.stages\)\)/)
  assert.doesNotMatch(screen, /points\.at\(-1\)\?\.elapsedMs/)
  assert.match(screen, /removeOverlappingFocusedTimeTicks/)
  assert.match(screen, /shouldShowTimelineLabel/)
  assert.match(screen, /gridTimeTicks\.map/)
  assert.match(screen, /pb-chart__time-label/)
  assert.match(styles, /\.pb-chart__time-label\{fill:#b5b5b5;font-size:11px/)
  assert.match(screen, /temperaturePath/)
})

test('stage strip is horizontally scrollable while the page remains fixed', () => {
  assert.match(styles, /\.pb-stage-strip\{[^}]*overflow-x:auto[^}]*overflow-y:hidden/)
  assert.match(styles, /\.pb-stage-strip\{[^}]*overscroll-behavior-x:contain/)
  assert.match(styles, /\.pb-stage-strip\{[^}]*touch-action:pan-x/)
  assert.match(styles, /\.pb-stage-strip\{height:calc\(var\(--pb-stage-height\) \+ 16px\);flex:0 0 calc\(var\(--pb-stage-height\) \+ 16px\);align-items:flex-end/)
  assert.match(styles, /\.pb-stage\.is-collapsed,\.pb-stage\.is-active,\.pb-add-stage\{transform:none\}/)
  assert.match(styles, /\.pb-add-stage\{justify-content:center;padding-top:0\}/)
  assert.match(screen, /current === index \? null : index/)
  assert.match(screen, /boundaryTicks/)
})

test('stage sequence remains explicit while one fluid card is edited in place', () => {
  assert.match(screen, /<ChartStageMarkers/)
  assert.doesNotMatch(screen, /pb-chart__stage-boundary/)
  assert.match(screen, /stageNumber = index \+ 1/)
  assert.match(screen, /pb-stage__summary-grid/)
  assert.match(screen, /Moves on by/)
  assert.match(screen, /activeStage === 0\s*\? cardLeft - inset/)
  assert.match(screen, /activeStage === lastStage\s*\? cardRight - strip\.clientWidth \+ inset/)
  assert.match(screen, /cardLeft \+ card\.offsetWidth \/ 2 - strip\.clientWidth \/ 2/)
  assert.match(screen, /addEventListener\('transitionend', handleTransitionEnd\)/)
  assert.match(screen, /addEventListener\('resize', alignActiveCard\)/)
  assert.doesNotMatch(screen, /card\.offsetLeft - \(strip\.clientWidth - card\.clientWidth\) \/ 2/)
  assert.doesNotMatch(screen, /<small>Stage \{index \+ 1\}<\/small>/)
})
