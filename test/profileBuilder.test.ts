import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { builderPumpMemory, builderTargetPoints, createDefaultProfileDraft, duplicateBuilderStage, moveBuilderStage, nextBuilderStage, profileDraftFromDecaidProfile, profileDraftToDecaidProfile, profileMaximumDurationMs, stageConstraintLabel, stageIndexAfterMove, switchBuilderPump, volumeCountStartAfterDelete } from '../src/features/profiles/profileBuilderModel.ts'
import { profileAuthorForAccount } from '../src/features/profiles/profileAuthor.ts'
import { assertVerifiedProfileRecord, canonicalProfileForVerification } from '../src/features/profiles/profileSaveVerification.ts'
import { nextBuilderStepperValue } from '../src/features/profiles/profileBuilderStepper.ts'
import { validateProfileDraft } from '../src/features/profiles/profileBuilderValidation.ts'

const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const profilesPanel = readFileSync(new URL('../src/features/profiles/ProfilesPanel.tsx', import.meta.url), 'utf8')
const screen = readFileSync(new URL('../src/features/profiles/ProfileBuilderScreen.tsx', import.meta.url), 'utf8')
const feature = readFileSync(new URL('../src/features/profiles/profileBuilderFeature.ts', import.meta.url), 'utf8')
const brewingData = readFileSync(new URL('../src/features/brew/useBrewingData.ts', import.meta.url), 'utf8')
const styles = readFileSync(new URL('../src/styles/index.css', import.meta.url), 'utf8')
const closeIcon = readFileSync(new URL('../src/assets/figma/builder-card-close.svg', import.meta.url), 'utf8')
const fastActiveIcon = readFileSync(new URL('../src/assets/figma/builder-transition-fast-active.svg', import.meta.url), 'utf8')
const smoothActiveIcon = readFileSync(new URL('../src/assets/figma/builder-transition-smooth-active.svg', import.meta.url), 'utf8')
const coffeeActiveIcon = readFileSync(new URL('../src/assets/figma/builder-coffee-source.svg', import.meta.url), 'utf8')
const coffeeMutedIcon = readFileSync(new URL('../src/assets/figma/builder-coffee-source-muted.svg', import.meta.url), 'utf8')
const waterActiveIcon = readFileSync(new URL('../src/assets/figma/builder-water-source-active.svg', import.meta.url), 'utf8')

test('keeps the unfinished profile builder hidden in normal releases while allowing an explicit RC build', () => {
  assert.match(app, /page === 'profile-builder' && profileBuilderEnabled\(\)/)
  assert.match(app, /editingEnabled=\{builderEnabled\}/)
  assert.match(feature, /if \(import\.meta\.env\.PROD\) return enabledValue\(import\.meta\.env\.VITE_ENABLE_PROFILE_BUILDER_RC\)/)
  assert.match(feature, /VITE_ENABLE_PROFILE_BUILDER/)
  assert.match(profilesPanel, /editingEnabled = false/)
  assert.match(profilesPanel, /editingEnabled && <button className="profiles-icon-button profiles-add"/)
})

test('profile builder entry points support create, safe copy, and user-owned editing without import', () => {
  assert.match(app, /const creatingProfile = builderEnabled && page === 'profile-builder' && !profileId/)
  assert.match(app, /onAddProfile=\{\(\) => navigate\('profile-builder'\)\}/)
  assert.match(app, /profileEditMode=\{\(selectedProfileId\) => data\.profileRecordForEditing\(selectedProfileId\)\?\.isDefault === false \? 'edit' : 'copy'\}/)
  assert.match(profilesPanel, /aria-label="Create profile"/)
  assert.match(profilesPanel, /profileEditMode\?\.\(profileId\) === 'edit' \? 'Edit profile' : 'Edit a copy'/)
  assert.doesNotMatch(profilesPanel, /Import and edit/)
})

test('cancel protects a changed profile draft while leaving an untouched draft immediately closable', () => {
  assert.match(screen, /const hasUnsavedChanges = JSON\.stringify\(draft\) !== JSON\.stringify\(initialDraft\)/)
  assert.match(screen, /if \(hasUnsavedChanges\) \{\s*setDiscardConfirmOpen\(true\)/)
  assert.match(screen, /role="alertdialog"/)
  assert.match(screen, /Discard profile changes\?/)
  assert.match(screen, /window\.addEventListener\('beforeunload', preserveUnsavedDraft\)/)
})

test('existing profiles only become saveable after a real draft change', () => {
  assert.match(screen, /const saveDisabled = saving \|\| !validation\.canSave \|\| Boolean\(initialRecord\) && !hasUnsavedChanges/)
  assert.match(screen, /disabled=\{saveDisabled\}/)
  assert.match(screen, /if \(!onSave \|\| saving \|\| Boolean\(initialRecord\) && !hasUnsavedChanges\) return/)
})

test('validation uses an issue-count warning icon after Save and has no ready status', () => {
  const actions = screen.slice(screen.indexOf('<div className="pb-topbar__actions">'), screen.indexOf('{saveError &&'))
  assert.ok(actions.indexOf('className="pb-save"') < actions.indexOf('pb-validation-indicator'))
  assert.match(actions, /validation\.issues\.length > 0/)
  assert.match(actions, /<span>\{validation\.issues\.length\}<\/span>/)
  assert.doesNotMatch(screen, /Ready to save/)
})

test('validation issue text stays legible on the tablet display', () => {
  assert.match(styles, /\.pb-validation-panel__issues strong\{font-size:12px/)
  assert.match(styles, /\.pb-validation-panel__issues small\{[^}]*font-size:12px;line-height:1\.4/)
})

test('favorite rows omit editing while the selected profile detail keeps it', () => {
  const favorites = profilesPanel.slice(profilesPanel.indexOf('<aside className="favorites-panel"'), profilesPanel.indexOf('<section className="profile-browser">'))
  assert.doesNotMatch(favorites, /onEditProfile/)
  assert.doesNotMatch(profilesPanel, /profileEditIcon/)
  assert.match(profilesPanel, /profileDetailEditIcon/)
  assert.match(profilesPanel, /onEditProfile\?\.\(selectedProfile\.id\)/)
})

test('edit-copy authorship uses a logged-in username and a privacy-safe fallback', () => {
  assert.equal(profileAuthorForAccount({ loggedIn: true, username: '  hendri  ' }), 'hendri')
  assert.equal(profileAuthorForAccount({ loggedIn: false, username: 'ignored' }), 'user')
  assert.equal(profileAuthorForAccount({ loggedIn: true }), 'user')
  assert.equal(profileAuthorForAccount(null), 'user')
  assert.match(brewingData, /const authoredProfile = \{ \.\.\.profile, author \}/)
  assert.match(brewingData, /profileAuthorForAccount\(await getDecentAccountStatus\(\)\.catch\(\(\) => null\)\)/)
})

test('saving a copy opens its detail without selecting or uploading it', () => {
  const saveImplementation = brewingData.slice(brewingData.indexOf('const saveProfileDraft'), brewingData.indexOf('const selectProfile'))
  assert.match(app, /onSaved=\{\(created\) => navigate\('profiles', created\.id\)\}/)
  assert.doesNotMatch(saveImplementation, /setMachineProfile|updateWorkflow\(/)
  assert.doesNotMatch(saveImplementation, /getWorkflow\(/)
  assert.match(saveImplementation, /createProfile\(authoredProfile, sourceProfileId, metadata\)/)
  assert.match(saveImplementation, /getProfile\(savedRecord\.id\)/)
  assert.match(saveImplementation, /visibility: 'visible'/)
  assert.doesNotMatch(saveImplementation, /storeLastSelectedProfileIdLocally\(savedRecord\.id\)/)
  assert.match(screen, /error instanceof Error && error\.message \? error\.message/)
})

test('local profile creation keeps the fixture catalogue available for continued testing', () => {
  assert.match(brewingData, /const fixtureFallback = allProfilesRef\.current\.filter/)
  assert.match(brewingData, /const savedProfiles = profileRecordsToDomain\(profileRecords\.current, \{\}, \[\]\)/)
  assert.match(brewingData, /profilesWithParsedTitles\(\[\.\.\.fixtureFallback, \.\.\.savedProfiles\]\)/)
})

test('profile save verification mirrors Decaid canonical profile output', () => {
  const draft = createDefaultProfileDraft()
  const profile = profileDraftToDecaidProfile(draft)
  delete profile.version
  delete profile.notes
  delete profile.author
  delete profile.target_weight
  delete profile.target_volume
  const canonical = canonicalProfileForVerification(profile)
  assert.equal(canonical.version, null)
  assert.equal(canonical.notes, '')
  assert.equal(canonical.author, '')
  assert.equal(canonical.target_weight, null)
  assert.equal(canonical.target_volume, null)
  assert.equal(canonical.steps[0].weight, 0)
  assert.equal(canonical.steps[0].exit?.value, 4)
  assert.equal(canonical.steps[0].limiter?.range, 0.6)
})

test('profile save verification preserves zeroes, stage order, lineage, and metadata', () => {
  const profile = profileDraftToDecaidProfile(createDefaultProfileDraft())
  const metadata = { description: 'Keep this', nested: { category: 'test' } }
  const record = {
    id: 'profile:verified',
    parentId: 'profile:source',
    visibility: 'visible',
    isDefault: false,
    profile: canonicalProfileForVerification(profile),
    metadata,
  }
  assert.doesNotThrow(() => assertVerifiedProfileRecord(profile, metadata, 'profile:source', record))

  const changedZero = structuredClone(record)
  changedZero.profile.steps[0].volume = 1
  assert.throws(() => assertVerifiedProfileRecord(profile, metadata, 'profile:source', changedZero), /execution data/i)

  const reordered = structuredClone(record)
  reordered.profile.steps.reverse()
  assert.throws(() => assertVerifiedProfileRecord(profile, metadata, 'profile:source', reordered), /execution data/i)

  const changedMetadata = structuredClone(record)
  changedMetadata.metadata = { description: 'Changed' }
  assert.throws(() => assertVerifiedProfileRecord(profile, metadata, 'profile:source', changedMetadata), /metadata/i)

  assert.throws(() => assertVerifiedProfileRecord(profile, metadata, 'profile:other', record), /lineage/i)
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

test('duplicating a stage copies every execution setting without sharing nested state', () => {
  const source = createDefaultProfileDraft().stages[0]
  const copy = duplicateBuilderStage(source, 1)
  assert.notEqual(copy.id, source.id)
  assert.equal(copy.name, 'Preinfusion copy')
  assert.deepEqual({ ...copy, id: source.id, name: source.name }, source)
  assert.notEqual(copy.exit, source.exit)
  assert.notEqual(copy.limiter, source.limiter)
})

test('reordering stages preserves stage identity and remaps the active index', () => {
  const stages = createDefaultProfileDraft().stages
  const reordered = moveBuilderStage(stages, 0, 2)
  assert.deepEqual(reordered.map((stage) => stage.id), [stages[1].id, stages[2].id, stages[0].id])
  assert.equal(stageIndexAfterMove(0, 0, 2), 2)
  assert.equal(stageIndexAfterMove(1, 0, 2), 0)
  assert.equal(stageIndexAfterMove(2, 0, 2), 1)
  assert.equal(stageIndexAfterMove(null, 0, 2), null)
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

test('a hidden limiter range is preserved exactly and is not invented when absent', () => {
  const source = {
    title: 'No limiter range',
    steps: [{ name: 'Hold', pump: 'pressure', pressure: 9, transition: 'fast', temperature: 93, sensor: 'coffee', seconds: 20, volume: 0, limiter: { value: 2 } }],
  } as const
  const draft = profileDraftFromDecaidProfile(source, { mode: 'edit', copyName: false })
  assert.deepEqual(draft.stages[0].limiter, { type: 'flow', value: 2 })
  assert.deepEqual(profileDraftToDecaidProfile(draft).steps?.[0].limiter, { value: 2 })
})

test('editing a user-owned profile keeps its name so it can overwrite the existing record', () => {
  const draft = profileDraftFromDecaidProfile({
    title: 'My daily profile',
    author: 'Previous author',
    beverage_type: 'espresso',
    steps: [{ name: 'Pour', pump: 'flow', flow: 2, transition: 'fast', temperature: 93, sensor: 'coffee', seconds: 30, volume: 0 }],
  }, {
    mode: 'edit',
    sourceProfileId: 'user-profile',
    existingTitles: ['My daily profile'],
    copyName: false,
  })

  assert.equal(draft.title, 'My daily profile')
  assert.match(screen, /const overwriteSource = initialRecord\?\.isDefault === false/)
  assert.match(screen, /copyName: !overwriteSource/)
  assert.match(brewingData, /const shouldOverwrite = overwriteSource && sourceRecord\?\.isDefault === false/)
  assert.match(brewingData, /updateProfile\(sourceProfileId, authoredProfile, metadata\)/)
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

test('pressure and flow switching restores both axis values without changing limiter range', () => {
  const pressureStage = {
    ...createDefaultProfileDraft().stages[2],
    pump: 'pressure' as const,
    target: 9,
    limiter: { type: 'flow' as const, value: 2.4, range: 0.6 },
  }
  const flow = switchBuilderPump(pressureStage, 'flow', builderPumpMemory(pressureStage))
  assert.deepEqual(flow.patch, {
    pump: 'flow',
    target: 2.4,
    limiter: { type: 'pressure', value: 9, range: 0.6 },
  })

  const pressure = switchBuilderPump({ ...pressureStage, ...flow.patch }, 'pressure', flow.memory)
  assert.deepEqual(pressure.patch, {
    pump: 'pressure',
    target: 9,
    limiter: { type: 'flow', value: 2.4, range: 0.6 },
  })
})

test('pressure and flow switching uses safe defaults only when no value was remembered', () => {
  const stage = { ...createDefaultProfileDraft().stages[2], limiter: undefined }
  const switched = switchBuilderPump(stage, 'flow', builderPumpMemory(stage))
  assert.equal(switched.patch.target, 2)
  assert.equal(switched.patch.limiter, undefined)
})

test('profile-builder steppers keep precise taps and use whole units while held', () => {
  assert.equal(nextBuilderStepperValue(2.4, 1, 0.1, 0, 12, false), 2.5)
  assert.equal(nextBuilderStepperValue(2.4, 1, 0.1, 0, 12, true), 3.4)
  assert.equal(nextBuilderStepperValue(2.4, -1, 0.1, 0, 12, true), 1.4)
  assert.equal(nextBuilderStepperValue(11.7, 1, 0.1, 0, 12, true), 12)
  assert.equal(nextBuilderStepperValue(undefined, 1, 0.1, 0, 12, true), 1)
  assert.equal(nextBuilderStepperValue(undefined, -1, 0.1, 0, 12, true), undefined)
  assert.match(screen, /setInterval\(\(\) => change\(direction, true\), 160\)/)
  assert.match(screen, /if \(!held && !cancelled\) change\(direction, false\)/)
})

test('profile maximum duration remains the sum of stage guardrails', () => {
  const draft = createDefaultProfileDraft()
  assert.equal(profileMaximumDurationMs(draft.stages), 70_000)

  draft.stages[0].seconds = 7
  draft.stages[1].seconds = 13
  draft.stages[2].seconds = 31

  assert.equal(profileMaximumDurationMs(draft.stages), 51_000)
  assert.equal(builderTargetPoints(draft.stages).at(-1)?.elapsedMs, 51_000)
})

test('profile validation keeps zero targets valid and separates errors from saveable warnings', () => {
  const draft = createDefaultProfileDraft()
  draft.stages[0].target = 0
  draft.targetVolumeCountStart = -1
  const validation = validateProfileDraft(draft)
  assert.equal(validation.errors.length, 0)
  assert.equal(validation.canSave, true)
  assert.ok(validation.warnings.some((issue) => issue.id === 'profile-no-final-target'))
  assert.equal(validation.warnings.some((issue) => issue.id === 'profile-volume-start-range'), false)
  assert.equal(validation.warnings.some((issue) => issue.id.endsWith('weight-scale')), false)
})

test('active volume fallback requires a readable existing starting step', () => {
  const draft = createDefaultProfileDraft()
  draft.targetVolume = 50
  draft.targetVolumeCountStart = -1
  const validation = validateProfileDraft(draft)
  const issue = validation.errors.find((item) => item.id === 'profile-volume-start-range')
  assert.equal(validation.canSave, false)
  assert.equal(issue?.message, 'Choose where volume measurement starts. The previously selected step no longer exists.')
})

test('profile validation blocks values that cannot be encoded by Decent firmware', () => {
  const draft = createDefaultProfileDraft()
  draft.stages[0].seconds = 128
  draft.stages[1].volume = 1024
  draft.stages[2].target = 16
  draft.stages[2].limiter = { type: 'flow', value: 2, range: undefined }
  const validation = validateProfileDraft(draft)
  assert.equal(validation.canSave, false)
  assert.ok(validation.errors.some((issue) => issue.field === 'seconds'))
  assert.ok(validation.errors.some((issue) => issue.field === 'volume'))
  assert.ok(validation.errors.some((issue) => issue.field === 'target'))
  assert.ok(validation.errors.some((issue) => issue.field === 'limiter'))
})

test('profile validation silently normalizes harmless imported values', () => {
  const draft = profileDraftFromDecaidProfile({
    title: 'Imported oddity',
    target_volume_count_start: '0' as unknown as number,
    tank_temperature: 0,
    steps: [{ name: '', pump: 'mystery', transition: 'later', sensor: 'group', pressure: 9, seconds: '10' as unknown as number, temperature: 93, volume: 0 }],
  }, { mode: 'import', copyName: false })
  const validation = validateProfileDraft(draft)
  assert.ok(validation.errors.some((issue) => issue.field === 'pump'))
  assert.ok(validation.errors.some((issue) => issue.field === 'transition'))
  assert.ok(validation.errors.some((issue) => issue.field === 'sensor'))
  assert.equal(validation.warnings.some((issue) => issue.field === 'seconds'), false)
  assert.equal(validation.warnings.some((issue) => issue.field === 'targetVolumeCountStart'), false)
  assert.equal(validation.warnings.some((issue) => issue.field === 'name'), false)
})

test('volume-count stage identity survives reorder and requires replacement only when its referenced stage is deleted', () => {
  assert.equal(stageIndexAfterMove(1, 1, 0), 0)
  assert.equal(stageIndexAfterMove(1, 0, 2), 0)
  assert.equal(volumeCountStartAfterDelete(2, 0, 2, true), 1)
  assert.equal(volumeCountStartAfterDelete(1, 1, 2, true), -1)
  assert.equal(volumeCountStartAfterDelete(1, 1, 2, false), 1)
})

test('validation flags likely unreachable and immediately satisfied exits without blocking save', () => {
  const draft = createDefaultProfileDraft()
  draft.targetWeight = 36
  draft.stages[1] = {
    ...draft.stages[1],
    pump: 'pressure',
    target: 8,
    limiter: { type: 'flow', value: 2, range: 0.4 },
    exit: { type: 'flow', condition: 'over', value: 3 },
  }
  draft.stages[2] = { ...draft.stages[2], exit: { type: 'pressure', condition: 'under', value: 10 } }
  const validation = validateProfileDraft(draft)
  assert.equal(validation.errors.length, 0)
  assert.match(validation.warnings.find((issue) => issue.id.endsWith('exit-beyond-limiter'))?.message ?? '', /Flow is limited to 2 ml\/s, so “above 3 ml\/s” probably won't be reached\. This step will still move on after 20 seconds or when another condition is met\./)
  assert.match(validation.warnings.find((issue) => issue.id.endsWith('exit-already-met'))?.message ?? '', /may begin around 8 bar/)
})

test('editor follows the designed high-level hierarchy without prototype-only fields', () => {
  assert.match(screen, /pb-stage__conditions-rule"><img src=\{skipNext\} alt="" \/><span>The next stage starts as soon as any condition on the left is met\.<\/span><\/p>/)
  assert.match(screen, /label: 'End shot yield'/)
  assert.match(screen, /<span>End shot yield <img/)
  assert.match(screen, /<small>Move on volume<\/small>/)
  assert.match(screen, /<small>Move on yield<\/small>/)
  assert.match(screen, /label="Move on volume"/)
  assert.match(screen, /label="Move on yield"/)
  assert.match(screen, /const label = `Move on \$\{type\}`/)
  assert.doesNotMatch(screen, /pb-condition__metric-label/)
  assert.match(screen, /\{comparisonLabel\} &gt;<\/button>/)
  assert.match(screen, /\{comparisonLabel\} &lt;<\/button>/)
  assert.match(styles, /\.pb-stage__conditions-panel\{[^}]*grid-template-columns:minmax\(0,1fr\) 112px/)
  assert.match(styles, /\.pb-stage__conditions-controls\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)[^}]*grid-template-rows:repeat\(2,minmax\(0,1fr\)\)[^}]*gap:12px 18px/)
  assert.match(styles, /\.pb-stage__conditions-controls::after\{[^}]*left:50%;[^}]*background:rgba\(192,192,192,.2\)/)
  assert.match(styles, /\.pb-stage__conditions-controls>\.pb-condition-column\{display:contents\}/)
  assert.match(styles, /\.pb-stage__conditions-rule\{[^}]*color:#d0d0d0;background:#454040[^}]*font-size:11px;font-weight:400/)
  assert.match(screen, /disabled=\{isLastStage\}/)
  assert.match(screen, /isLastStage=\{index === draft\.stages\.length - 1\}/)
  assert.match(screen, /Measure from/)
  assert.match(screen, /Category \(optional\)/)
  assert.doesNotMatch(screen, /Prototype only/)
  assert.doesNotMatch(screen, />Limiter range</)
  assert.match(screen, /aria-label="Add stage"/)
  assert.match(screen, /nextBuilderStage/)
})

test('editor panels use a true close icon rather than the add-stage plus', () => {
  assert.match(screen, /aria-label="Close validation"><img src=\{builderCardClose\}/)
  assert.match(closeIcon, /M3\.75 3\.75L14\.25 14\.25/)
  assert.match(closeIcon, /M14\.25 3\.75L3\.75 14\.25/)
})

test('transition and temperature-source icons turn green only while selected', () => {
  assert.match(screen, /value === 'fast' \? builderTransitionFastActive : builderTransitionFast/)
  assert.match(screen, /value === 'smooth' \? builderTransitionSmoothActive : builderTransitionSmooth/)
  assert.match(screen, /value === 'coffee' \? builderCoffeeSource : builderCoffeeSourceMuted/)
  assert.match(screen, /value === 'water' \? builderWaterSourceActive : builderWaterSource/)
  for (const icon of [fastActiveIcon, smoothActiveIcon, coffeeActiveIcon, waterActiveIcon]) assert.match(icon, /#53D68E|#57C98A/)
  assert.doesNotMatch(coffeeMutedIcon, /#53D68E|#57C98A/)
  assert.match(coffeeMutedIcon, /#C0C0C0/)
})

test('scale-dependent exits do not produce redundant validation warnings', () => {
  const draft = createDefaultProfileDraft()
  draft.targetWeight = 36
  draft.stages[0] = { ...draft.stages[0], weight: 5 }
  const validation = validateProfileDraft(draft)
  assert.equal(validation.issues.some((issue) => issue.id.endsWith('weight-scale')), false)
})

test('the header exposes every Decaid profile-level prerequisite and hidden limiter range', () => {
  assert.match(screen, /aria-controls="profile-builder-details"/)
  assert.match(screen, /Profile details and advanced settings/)
  assert.match(screen, />Beverage type</)
  assert.match(screen, />Profile format</)
  assert.match(screen, />Author</)
  assert.match(screen, /Set from the signed-in account when saved/)
  assert.match(screen, />Notes</)
  assert.match(screen, />End shot yield</)
  assert.match(screen, />End shot volume fallback</)
  assert.match(screen, /volumeFallbackActive && <label data-builder-field="targetVolumeCountStart"/)
  assert.match(screen, />Start measuring from</)
  assert.match(screen, /<option value="" disabled>Choose a step<\/option>/)
  assert.match(screen, /\{index \+ 1\}\. \{stage\.name\.trim\(\) \|\| `Step \$\{index \+ 1\}`\}/)
  assert.doesNotMatch(screen, />Volume count start</)
  assert.doesNotMatch(screen, /<small>frame<\/small>/)
  assert.match(screen, />Tank temperature</)
  assert.match(screen, />Stage limiter response range</)
  assert.match(screen, /updateLimiterRange/)
  assert.match(screen, /readOnly aria-describedby="profile-builder-author-help"/)
  assert.match(styles, /\.pb-profile-details\{position:absolute/)
})

test('advanced settings opens from a compact title-row disclosure', () => {
  const metadata = screen.slice(screen.indexOf('<div className="pb-topbar__metadata">'), screen.indexOf('<div className="pb-topbar__actions">'))
  assert.match(screen, /className=\{`pb-more-settings/)
  assert.match(screen, /<span>More settings<\/span>/)
  assert.match(screen, /<div><h2>More settings<\/h2>/)
  assert.doesNotMatch(metadata, /Profile details/)
  assert.doesNotMatch(metadata, />Hide<|>View</)
  assert.match(styles, /\.pb-topbar__identity-actions\{display:flex/)
  assert.match(styles, /\.pb-more-settings\.is-open img\{transform:rotate\(180deg\)\}/)
})

test('stage cards use the compact Figma dimensions and compact further on short screens', () => {
  assert.match(styles, /profile-builder-screen\.pb-screen\{[\s\S]*?height:100dvh[^}]*display:flex[^}]*overflow:hidden/)
  assert.match(styles, /\.pb-chart,\.pb-screen\.has-active-stage \.pb-chart\{height:auto;min-height:118px;flex:1 1 auto\}/)
  assert.match(styles, /\.profile-builder-screen\.pb-screen\{--pb-stage-height:265px\}/)
  assert.match(styles, /\.pb-stage\.is-collapsed\{width:305px;flex-basis:305px/)
  assert.match(styles, /\.pb-stage\.is-active\{width:600px;flex-basis:600px/)
  assert.match(styles, /\.pb-stage,\.pb-add-stage\{height:var\(--pb-stage-height\)\}/)
  assert.match(styles, /@media\(max-height:650px\)\{\.profile-builder-screen\.pb-screen\{--pb-stage-height:245px\}/)
  assert.match(styles, /\.pb-stage__target-panel\{display:grid;grid-template-columns:minmax\(0,1fr\) 153px/)
  assert.match(styles, /\.pb-stage__conditions-panel\{display:grid;grid-template-columns:minmax\(0,1fr\) 112px/)
  assert.match(styles, /\.pb-stage__target-main\{position:relative;[^}]*padding-right:0;border-right:0\}/)
  assert.match(styles, /\.pb-stage__target-main::after\{[^}]*left:50%;[^}]*background:rgba\(192,192,192,.2\)/)
  assert.doesNotMatch(screen, /pb-stage__connector/)
})

test('builder chart uses the established profile colors and includes temperature', () => {
  assert.match(styles, /\.pb-chart__line--flow\{stroke:var\(--chart-flow\)\}/)
  assert.match(styles, /\.pb-chart__line--pressure\{stroke:var\(--chart-pressure\)\}/)
  assert.match(styles, /\.pb-chart__line--temperature\{stroke:var\(--chart-temperature\)\}/)
  assert.match(styles, /\.pb-chart\{--pb-plot-origin:54px/)
  assert.match(screen, /<ChartLegend mode="profile" showWeight=\{false\}/)
  assert.match(screen, /<ChartStageMarkers/)
  assert.match(screen, /<span>bar \/ ml\/s<\/span>/)
  assert.match(styles, /\.pb-chart__axis>span\{[^}]*top:7px/)
  assert.match(styles, /\.pb-chart>svg\{[^}]*left:var\(--pb-plot-origin\)[^}]*width:calc\(100% - var\(--pb-plot-origin\)\)/)
  assert.match(screen, /endMs: startMs \+ profileMaximumDurationMs\(\[stage\]\)/)
  assert.match(screen, /const maximumDurationMs = Math\.max\(1, profileMaximumDurationMs\(draft\.stages\)\)/)
  assert.doesNotMatch(screen, /points\.at\(-1\)\?\.elapsedMs/)
  assert.doesNotMatch(screen, /removeOverlappingFocusedTimeTicks/)
  assert.doesNotMatch(screen, /shouldShowTimelineLabel/)
  assert.doesNotMatch(screen, /gridTimeTicks/)
  assert.doesNotMatch(screen, /pb-chart__time-label/)
  assert.doesNotMatch(screen, /pb-chart__time-grid/)
  assert.doesNotMatch(styles, /\.pb-chart__time-label/)
  assert.doesNotMatch(styles, /\.pb-chart__time-grid/)
  assert.match(styles, /\.pb-chart>\.chart-stage-markers \.chart-stage-marker\{border-left:0\}/)
  assert.match(screen, /const stageBoundaries = stageMarkers\.slice\(0, -1\)\.map\(\(stage\) => stage\.endMs\)/)
  assert.match(screen, /className="pb-chart__stage-separator"/)
  assert.match(styles, /\.pb-chart__stage-separator\{stroke:rgba\(255,255,255,\.16\)/)
  assert.match(screen, /temperaturePath/)
})

test('stage strip is horizontally scrollable while the page remains fixed', () => {
  assert.match(styles, /\.pb-stage-strip\{[^}]*overflow-x:auto[^}]*overflow-y:hidden/)
  assert.match(styles, /\.pb-stage-strip\{[^}]*overflow-anchor:none/)
  assert.match(styles, /\.pb-stage-strip\{[^}]*overscroll-behavior-x:contain/)
  assert.match(styles, /\.pb-stage-strip\{[^}]*touch-action:pan-x/)
  assert.match(styles, /\.pb-stage-strip\{height:calc\(var\(--pb-stage-height\) \+ 16px\);flex:0 0 calc\(var\(--pb-stage-height\) \+ 16px\);align-items:flex-end/)
  assert.match(styles, /\.pb-stage\.is-collapsed,\.pb-stage\.is-active,\.pb-add-stage\{transform:none\}/)
  assert.match(styles, /\.pb-add-stage\{justify-content:center;padding-top:0\}/)
  assert.match(screen, /current === index \? null : index/)
  assert.doesNotMatch(screen, /boundaryTicks/)
})

test('touching outside the stage cards dismisses the active stage', () => {
  assert.match(screen, /onPointerDownCapture=\{dismissActiveStageFromOutside\}/)
  assert.match(screen, /if \(target instanceof Element && target\.closest\('\.pb-stage'\)\) return/)
  assert.match(screen, /setActiveStage\(null\)/)
})

test('stage sequence remains explicit while one fluid card is edited in place', () => {
  assert.match(screen, /<ChartStageMarkers/)
  assert.doesNotMatch(screen, /pb-chart__stage-boundary/)
  assert.match(screen, /stageNumber = index \+ 1/)
  assert.match(screen, /pb-stage__summary-metrics/)
  assert.match(screen, /\{stage\.pump === 'pressure' \? 'Pressure' : 'Flow'\} Target/)
  assert.match(screen, /typeof limiterValue === 'number' && limiterValue > 0 && <i>Max \{formatValue\(limiterValue\)\} \{limiterUnit\}/)
  assert.match(screen, /\{stage\.sensor === 'water' \? 'Water' : 'Coffee'\} temperature/)
  assert.match(screen, /pb-stage__target-panel/)
  assert.match(screen, /pb-stage__conditions-panel/)
  assert.match(screen, /Moves on when any is reached/)
  assert.match(screen, /\.filter\(\(condition\): condition is string => Boolean\(condition\)\)\.join\(' \/ '\)/)
  assert.match(screen, /role="tablist" aria-label="Stage settings"/)
  assert.match(screen, /role="tabpanel" aria-label="Target controls"/)
  assert.match(screen, /role="tabpanel" aria-label="Move on conditions"/)
  assert.match(screen, /aria-label="Drag to reorder stage"/)
  assert.match(screen, /Duplicate stage/)
  assert.match(screen, /Delete stage/)
  assert.doesNotMatch(screen, /Close stage/)
  assert.match(screen, /canDelete=\{draft\.stages\.length > 1\}/)
  assert.match(screen, /stageIndexAfterMove/)
  assert.match(styles, /\.pb-stage__drag-handle\{[^}]*touch-action:none/)
  assert.match(screen, /card\.cloneNode\(true\)/)
  assert.match(screen, /classList\.add\('pb-stage-drag-overlay'\)/)
  assert.match(screen, /cancelStageDrag\(\)/)
  assert.match(screen, /onLostPointerCapture=/)
  assert.match(screen, /window\.addEventListener\('pointercancel', finishPointerDrag, true\)/)
  assert.match(screen, /window\.addEventListener\('blur', cancelInterruptedDrag\)/)
  assert.match(screen, /if \(transitionEvent\.target !== drag\.overlay \|\| transitionEvent\.propertyName !== 'transform'\) return/)
  assert.match(screen, /drag\.cleanupTimer = window\.setTimeout\(removeOverlay, 280\)/)
  assert.match(screen, /requestAnimationFrame\(runStageDragFrame\)/)
  assert.match(screen, /card\.animate\(\[/)
  assert.match(screen, /const y = clamp\(desiredY, minimumY, maximumY\)/)
  assert.match(styles, /\.pb-stage\.is-dragging\{opacity:0/)
  assert.match(styles, /\.pb-stage\.pb-stage-drag-overlay\{[^}]*position:fixed[^}]*pointer-events:none[^}]*opacity:1[^}]*background:rgba\(49,42,42,\.98\)[^}]*scale\(1\.025\)/)
  assert.match(styles, /\.pb-stage\.pb-stage-drag-overlay\.is-dropping\{[^}]*transition:transform 190ms/)
  assert.match(screen, /activePanel === 'target'/)
  assert.match(styles, /\.pb-stage__summary-metrics\{height:123px;display:grid;grid-template-columns:1fr 1fr/)
  assert.match(styles, /\.pb-stage__target-panel \.pb-stepper>button,\.pb-stage__conditions-panel \.pb-stepper>button\{width:30px;height:30px;flex:0 0 30px\}/)
  assert.match(styles, /\.pb-condition__comparison button\{[^}]*white-space:nowrap/)
  assert.match(styles, /\.pb-stage__tabs\{width:158px;height:26px;display:grid;grid-template-columns:1fr 1fr/)
  assert.match(styles, /\.pb-stage__tabs button\.is-selected\{color:#383431;background:#53d68e/)
  assert.match(styles, /--pb-label-color:#707070/)
  assert.match(styles, /--pb-value-color:#f5f5f5/)
  assert.match(styles, /\.pb-chart\{--pb-plot-origin:54px/)
  assert.match(styles, /\.pb-chart__axis\{[^}]*width:54px[^}]*color:var\(--pb-label-color\)/)
  assert.match(styles, /\.pb-stage__summary-metrics small\{height:19px;color:var\(--pb-label-color\)/)
  assert.match(styles, /\.pb-stage__summary-metrics strong\{[^}]*color:var\(--pb-value-color\)/)
  assert.match(styles, /\.pb-stage__summary-metrics>span\{[^}]*align-items:center[^}]*text-align:center/)
  assert.match(styles, /\.pb-stage__choice-control>.pb-segmented button\{height:65px;display:flex;flex-direction:column/)
  assert.match(styles, /\.pb-stage__choice-control>.pb-segmented button\{[^}]*background:#454040/)
  assert.match(styles, /\.pb-stage__limits\{[^}]*background:#454040/)
  assert.match(styles, /\.pb-condition__comparison\{[^}]*background:#454040/)
  assert.match(styles, /\.pb-condition__comparison button\.is-selected\{[^}]*background:#5e5a55/)
  assert.match(styles, /\.pb-segmented--pump\{background:#454040/)
  assert.match(styles, /\.pb-segmented--pump button\.is-selected\{color:#c0c0c0;background:#5e5a55/)
  assert.doesNotMatch(styles, /\.pb-segmented--pump button\.is-(?:flow|pressure)\{background:/)
  assert.match(screen, /activeStage === 0\s*\? cardLeft - inset/)
  assert.match(screen, /activeStage === lastStage\s*\? cardRight - strip\.clientWidth \+ inset/)
  assert.match(screen, /cardLeft \+ card\.offsetWidth \/ 2 - strip\.clientWidth \/ 2/)
  assert.match(screen, /addEventListener\('transitionend', handleTransitionEnd\)/)
  assert.match(screen, /addEventListener\('resize', alignActiveCard\)/)
  assert.doesNotMatch(screen, /card\.offsetLeft - \(strip\.clientWidth - card\.clientWidth\) \/ 2/)
  assert.doesNotMatch(screen, /<small>Stage \{index \+ 1\}<\/small>/)
})
