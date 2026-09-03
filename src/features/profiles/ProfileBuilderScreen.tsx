import { useMemo, useState } from 'react'
import profilesBackIcon from '../../assets/figma/profiles-back.svg'
import type { ProfileTargetPoint } from '../../domain/brewing'
import { builderTargetPoints, createDefaultProfileDraft, nextBuilderStage } from './profileBuilderModel'
import type { BuilderExitCondition, BuilderExitType, BuilderStage, ProfileDraft } from './profileBuilderModel'

const CHART_WIDTH = 760
const CHART_HEIGHT = 188
const CHART_TOP = 18
const CHART_BOTTOM = 26

const pathFor = (points: ProfileTargetPoint[], key: 'pressure' | 'flow', maximum: number, duration: number) => points.reduce((path, point, index) => {
  const x = (point.elapsedMs / duration) * CHART_WIDTH
  const value = point[key] ?? 0
  const y = CHART_HEIGHT - CHART_BOTTOM - Math.max(0, Math.min(1, value / maximum)) * (CHART_HEIGHT - CHART_TOP - CHART_BOTTOM)
  return `${path}${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
}, '')

const numeric = (value: string, fallback: number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function BuilderChart({ draft, activeStage }: { draft: ProfileDraft; activeStage: number }) {
  const points = builderTargetPoints(draft.stages)
  const duration = Math.max(1, points.at(-1)?.elapsedMs ?? 1)
  const spans = draft.stages.map((stage, index) => {
    const start = draft.stages.slice(0, index).reduce((total, item) => total + item.seconds * 1000, 0)
    return { start, end: start + stage.seconds * 1000, id: stage.id }
  })

  return <section className="profile-builder-chart" aria-label="Profile target preview">
    <header>
      <div><span>Target preview</span><strong>{Math.round(duration / 1000)} seconds</strong></div>
      <div className="profile-builder-chart__legend">
        <span><i className="profile-builder-chart__pressure" />Pressure</span>
        <span><i className="profile-builder-chart__flow" />Flow</span>
      </div>
    </header>
    <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} preserveAspectRatio="none" role="img" aria-label="Pressure and flow targets across the profile stages">
      {[0, 1, 2, 3].map((line) => <line key={line} className="profile-builder-chart__grid" x1="0" x2={CHART_WIDTH} y1={CHART_TOP + line * 44} y2={CHART_TOP + line * 44} />)}
      {spans.map((span, index) => <rect key={span.id} className={index === activeStage ? 'profile-builder-chart__stage profile-builder-chart__stage--active' : 'profile-builder-chart__stage'} x={span.start / duration * CHART_WIDTH} y="0" width={(span.end - span.start) / duration * CHART_WIDTH} height={CHART_HEIGHT - CHART_BOTTOM} />)}
      <path className="profile-builder-chart__line profile-builder-chart__line--pressure" d={pathFor(points, 'pressure', 12, duration)} />
      <path className="profile-builder-chart__line profile-builder-chart__line--flow" d={pathFor(points, 'flow', 6, duration)} />
      {spans.map((span, index) => <text key={`${span.id}-label`} x={(span.start + span.end) / 2 / duration * CHART_WIDTH} y={CHART_HEIGHT - 7} textAnchor="middle">{index + 1}</text>)}
    </svg>
  </section>
}

interface StageEditorCardProps {
  stage: BuilderStage
  index: number
  active: boolean
  onActivate: () => void
  onChange: (patch: Partial<BuilderStage>) => void
  onDuplicate: () => void
}

function StageEditorCard({ stage, index, active, onActivate, onChange, onDuplicate }: StageEditorCardProps) {
  const setPump = (pump: BuilderStage['pump']) => onChange({
    pump,
    target: pump === stage.pump ? stage.target : pump === 'pressure' ? 9 : 3,
    limiter: stage.limiter ? { ...stage.limiter, type: pump === 'pressure' ? 'flow' : 'pressure' } : undefined,
  })
  const targetUnit = stage.pump === 'pressure' ? 'bar' : 'ml/s'
  const limiterUnit = stage.limiter?.type === 'pressure' ? 'bar' : 'ml/s'
  const thresholdUnit = stage.exit?.type === 'pressure' ? 'bar' : 'ml/s'

  return <article className={active ? 'profile-builder-stage-editor-card is-active' : 'profile-builder-stage-editor-card'} onPointerDownCapture={onActivate}>
    <header>
      <div><span>Stage {index + 1}</span><input aria-label={`Stage ${index + 1} name`} value={stage.name} onChange={(event) => onChange({ name: event.target.value })} /></div>
      <strong>{stage.seconds}<small>s</small></strong>
    </header>

    <div className="profile-builder-stage-row profile-builder-stage-row--control">
      <label>Control</label>
      <div className="profile-builder-stage-segmented" role="group" aria-label={`Stage ${index + 1} controlled axis`}>
        <button type="button" className={stage.pump === 'flow' ? 'is-active is-flow' : ''} onClick={() => setPump('flow')}>Flow</button>
        <button type="button" className={stage.pump === 'pressure' ? 'is-active is-pressure' : ''} onClick={() => setPump('pressure')}>Pressure</button>
      </div>
      <NumberField label="Control target" value={stage.target} unit={targetUnit} step="0.1" onChange={(value) => onChange({ target: value })} />
    </div>

    <div className="profile-builder-stage-row">
      <label>Transition</label>
      <div className="profile-builder-stage-segmented profile-builder-stage-segmented--neutral" role="group" aria-label="Target transition">
        <button type="button" className={stage.transition === 'fast' ? 'is-active' : ''} onClick={() => onChange({ transition: 'fast' })}>Fast</button>
        <button type="button" className={stage.transition === 'smooth' ? 'is-active' : ''} onClick={() => onChange({ transition: 'smooth' })}>Smooth</button>
      </div>
    </div>

    <div className="profile-builder-stage-row profile-builder-stage-row--limiter">
      <label>{stage.pump === 'pressure' ? 'Flow limiter' : 'Pressure limiter'}</label>
      <button className={stage.limiter ? 'profile-builder-stage-enable is-active' : 'profile-builder-stage-enable'} type="button" onClick={() => onChange({ limiter: stage.limiter ? undefined : { type: stage.pump === 'pressure' ? 'flow' : 'pressure', value: stage.pump === 'pressure' ? 2.5 : 6, range: 0.4 } })}>{stage.limiter ? 'On' : 'Off'}</button>
      {stage.limiter && <>
        <NumberField label="Limiter value" value={stage.limiter.value} unit={limiterUnit} step="0.1" onChange={(value) => onChange({ limiter: stage.limiter ? { ...stage.limiter, value } : undefined })} />
        <NumberField label="Limiter range" value={stage.limiter.range} unit="range" step="0.1" onChange={(range) => onChange({ limiter: stage.limiter ? { ...stage.limiter, range } : undefined })} />
      </>}
    </div>

    <div className="profile-builder-stage-row">
      <label>Temperature</label>
      <NumberField label="Temperature" value={stage.temperature} unit="°C" step="0.5" onChange={(temperature) => onChange({ temperature })} />
    </div>

    <div className="profile-builder-stage-row">
      <label>Temperature sensor</label>
      <div className="profile-builder-stage-segmented profile-builder-stage-segmented--neutral" role="group" aria-label="Temperature sensor">
        <button type="button" className={stage.sensor === 'water' ? 'is-active' : ''} onClick={() => onChange({ sensor: 'water' })}>Water</button>
        <button type="button" className={stage.sensor === 'coffee' ? 'is-active' : ''} onClick={() => onChange({ sensor: 'coffee' })}>Coffee</button>
      </div>
    </div>

    <section className="profile-builder-stage-advance" aria-label="Advance this stage when">
      <h3>Move on if</h3>
      <div className="profile-builder-stage-field">
        <span>Time limit</span>
        <NumberField label="Stage time limit" value={stage.seconds} unit="sec" min="1" onChange={(seconds) => onChange({ seconds: Math.max(1, seconds) })} />
      </div>
      <div className="profile-builder-stage-field">
        <span>Sensor threshold</span>
        <button className={stage.exit ? 'profile-builder-stage-enable is-active' : 'profile-builder-stage-enable'} type="button" onClick={() => onChange({ exit: stage.exit ? undefined : { type: stage.pump === 'flow' ? 'pressure' : 'flow', condition: 'over', value: stage.pump === 'flow' ? 4 : 2.5 } })}>{stage.exit ? 'On' : 'Off'}</button>
        {stage.exit && <div className="profile-builder-threshold">
          <select aria-label="Threshold axis" value={stage.exit.type} onChange={(event) => onChange({ exit: stage.exit ? { ...stage.exit, type: event.target.value as BuilderExitType } : undefined })}><option value="pressure">Pressure</option><option value="flow">Flow</option></select>
          <select aria-label="Threshold direction" value={stage.exit.condition} onChange={(event) => onChange({ exit: stage.exit ? { ...stage.exit, condition: event.target.value as BuilderExitCondition } : undefined })}><option value="over">Above</option><option value="under">Below</option></select>
          <NumberField label="Threshold value" value={stage.exit.value} unit={thresholdUnit} step="0.1" onChange={(value) => onChange({ exit: stage.exit ? { ...stage.exit, value } : undefined })} />
        </div>}
      </div>
      <div className="profile-builder-stage-field">
        <span>Stage scale weight</span>
        <button className={stage.weight === undefined ? 'profile-builder-stage-enable' : 'profile-builder-stage-enable is-active'} type="button" onClick={() => onChange({ weight: stage.weight === undefined ? 8 : undefined })}>{stage.weight === undefined ? 'Off' : 'On'}</button>
        {stage.weight !== undefined && <NumberField label="Stage scale weight" value={stage.weight} unit="g" step="0.1" onChange={(weight) => onChange({ weight })} />}
      </div>
      <div className="profile-builder-stage-field">
        <span>Volume safety limit</span>
        <NumberField label="Stage volume safety limit" value={stage.volume} unit="ml" min="0" onChange={(volume) => onChange({ volume: Math.max(0, volume) })} />
      </div>
      <p>Scale weight advances this stage only. Whole-shot stop is configured above.</p>
    </section>

    <footer><button type="button" onClick={onDuplicate}>Duplicate stage</button></footer>
  </article>
}

interface NumberFieldProps {
  label: string
  value: number
  unit: string
  step?: string
  min?: string
  onChange: (value: number) => void
}

function NumberField({ label, value, unit, step, min, onChange }: NumberFieldProps) {
  return <div className="profile-builder-stage-number">
    <input aria-label={label} type="number" min={min} step={step} value={value} onChange={(event) => onChange(numeric(event.target.value, 0))} />
    <small>{unit}</small>
  </div>
}

export function ProfileBuilderScreen({ onClose }: { onClose: () => void }) {
  const [draft, setDraft] = useState(createDefaultProfileDraft)
  const [activeStage, setActiveStage] = useState(0)
  const [category, setCategory] = useState('Espresso')
  const [saved, setSaved] = useState(false)
  const totalDuration = useMemo(() => draft.stages.reduce((total, stage) => total + stage.seconds, 0), [draft.stages])

  const updateDraft = <Key extends keyof ProfileDraft>(key: Key, value: ProfileDraft[Key]) => {
    setSaved(false)
    setDraft((current) => ({ ...current, [key]: value }))
  }
  const updateStage = (index: number, patch: Partial<BuilderStage>) => {
    setSaved(false)
    setDraft((current) => ({ ...current, stages: current.stages.map((stage, stageIndex) => stageIndex === index ? { ...stage, ...patch } : stage) }))
  }
  const addStage = () => {
    const nextIndex = draft.stages.length
    setDraft((current) => ({ ...current, stages: [...current.stages, nextBuilderStage(current.stages.length)] }))
    setActiveStage(nextIndex)
    setSaved(false)
  }
  const duplicateStage = (index: number) => {
    const source = draft.stages[index]
    const copy = { ...source, id: `${source.id}-copy-${draft.stages.length}`, name: `${source.name} copy`, exit: source.exit ? { ...source.exit } : undefined, limiter: source.limiter ? { ...source.limiter } : undefined }
    setDraft((current) => ({ ...current, stages: [...current.stages.slice(0, index + 1), copy, ...current.stages.slice(index + 1)] }))
    setActiveStage(index + 1)
    setSaved(false)
  }

  return <main className="profile-builder-screen profile-builder-screen--figma-flow">
    <header className="profile-builder-topbar">
      <div className="profile-builder-profile-identity">
        <button type="button" onClick={onClose} aria-label="Back to profiles"><img src={profilesBackIcon} alt="" /></button>
        <div><span>Profile name</span><input aria-label="Profile name" value={draft.title} onChange={(event) => updateDraft('title', event.target.value)} /></div>
      </div>
      <div className="profile-builder-topbar-metrics">
        <label><span>Category</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option>Espresso</option><option>Filter</option><option>Tea</option><option>Cleaning</option></select></label>
        <label><span>Type</span><select value={draft.beverageType} onChange={(event) => updateDraft('beverageType', event.target.value as ProfileDraft['beverageType'])}><option value="espresso">Espresso</option><option value="pourover">Pour over</option><option value="manual">Manual</option><option value="cleaning">Cleaning</option></select></label>
        <label><span>Whole-shot stop at weight</span><div><input aria-label="Whole-shot target yield" type="number" step="0.1" value={draft.targetWeight ?? ''} onChange={(event) => updateDraft('targetWeight', event.target.value === '' ? undefined : numeric(event.target.value, 0))} /><small>g</small></div></label>
        <label><span>Volume fallback</span><div><input aria-label="Whole-shot target volume" type="number" value={draft.targetVolume ?? ''} onChange={(event) => updateDraft('targetVolume', event.target.value === '' ? undefined : numeric(event.target.value, 0))} /><small>ml</small></div></label>
        <label><span>Count volume from</span><div><input aria-label="Target volume count start" type="number" value={draft.targetVolumeCountStart} onChange={(event) => updateDraft('targetVolumeCountStart', numeric(event.target.value, 0))} /><small>stage</small></div></label>
        <div className="profile-builder-total"><span>Duration</span><strong>{totalDuration}<small>s</small></strong></div>
      </div>
      <div className="profile-builder-topbar-actions">
        <span>{saved ? 'Draft saved locally' : 'Prototype only — nothing is uploaded'}</span>
        <button className="profile-builder-cancel" type="button" onClick={onClose}>Cancel</button>
        <button className="profile-builder-save" type="button" onClick={() => setSaved(true)}>Save</button>
      </div>
    </header>

    <section className="profile-builder-figma-chart"><BuilderChart draft={draft} activeStage={activeStage} /></section>

    <section className="profile-builder-editor-strip" aria-label="Editable brew stages">
      {draft.stages.map((stage, index) => <StageEditorCard key={stage.id} stage={stage} index={index} active={index === activeStage} onActivate={() => setActiveStage(index)} onChange={(patch) => updateStage(index, patch)} onDuplicate={() => duplicateStage(index)} />)}
      <button className="profile-builder-add-editor-card" type="button" onClick={addStage}><span>＋</span><strong>Add stage</strong><small>Continue the profile</small></button>
    </section>

    <footer className="profile-builder-ownership-note"><span>Machine-owned</span> target, transition, temperature, duration and sensor exits <i /> <span>Decaid-owned</span> stage weight exits and final yield</footer>
  </main>
}
