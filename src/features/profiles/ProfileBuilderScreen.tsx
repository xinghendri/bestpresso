import { useMemo, useState } from 'react'
import builderCategoryChevron from '../../assets/figma/builder-category-chevron.svg'
import builderStepMinus from '../../assets/figma/builder-step-minus.svg'
import builderStepMinusMuted from '../../assets/figma/builder-step-minus-muted.svg'
import builderStepPlus from '../../assets/figma/builder-step-plus.svg'
import builderTransitionFast from '../../assets/figma/builder-transition-fast.svg'
import builderTransitionSmooth from '../../assets/figma/builder-transition-smooth.svg'
import builderValueChevron from '../../assets/figma/builder-value-chevron.svg'
import { useValueAdjustment } from '../../components/ValueAdjustment/ValueAdjustmentContext'
import type { ProfileTargetPoint } from '../../domain/brewing'
import { VALUE_ADJUSTMENTS } from '../../domain/valueAdjustments'
import { builderTargetPoints, createDefaultProfileDraft, nextBuilderStage } from './profileBuilderModel'
import type { BuilderExitType, BuilderStage, ProfileDraft } from './profileBuilderModel'

const CHART_WIDTH = 1090
const CHART_HEIGHT = 270
const PLOT_TOP = 58
const PLOT_BOTTOM = 260

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const rounded = (value: number) => Math.round(value * 10) / 10
const formatValue = (value: number | undefined) => value === undefined || value <= 0 ? '-' : Number.isInteger(value) ? String(value) : value.toFixed(1)

const pathFor = (points: ProfileTargetPoint[], key: 'pressure' | 'flow' | 'temperature', duration: number, minimum: number, maximum: number) => points.reduce((path, point, index) => {
  const x = duration > 0 ? point.elapsedMs / duration * CHART_WIDTH : 0
  const value = point[key] ?? minimum
  const y = PLOT_BOTTOM - clamp((value - minimum) / (maximum - minimum), 0, 1) * (PLOT_BOTTOM - PLOT_TOP)
  return `${path}${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
}, '')

function BuilderChart({ draft, activeStage }: { draft: ProfileDraft; activeStage: number }) {
  const points = builderTargetPoints(draft.stages)
  const duration = Math.max(1, points.at(-1)?.elapsedMs ?? 1)
  const stageStart = draft.stages.slice(0, activeStage).reduce((total, stage) => total + stage.seconds * 1000, 0)
  const stageEnd = stageStart + (draft.stages[activeStage]?.seconds ?? 0) * 1000
  const clipX = stageStart / duration * CHART_WIDTH
  const clipWidth = Math.max(1, (stageEnd - stageStart) / duration * CHART_WIDTH)
  const pressurePath = pathFor(points, 'pressure', duration, 0, 12)
  const flowPath = pathFor(points, 'flow', duration, 0, 12)
  const temperaturePath = pathFor(points, 'temperature', duration, 70, 100)

  return <section className="pb-chart" aria-label="Profile target preview">
    <div className="pb-chart__axis" aria-hidden="true">
      <span>Bar <b>/</b> ml/s</span>
      {[12, 9, 6, 3, 0].map((value) => <i key={value} style={{ top: `${(PLOT_TOP + (12 - value) / 12 * (PLOT_BOTTOM - PLOT_TOP)) / CHART_HEIGHT * 100}%` }}>{value}</i>)}
    </div>
    <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} preserveAspectRatio="none" role="img" aria-label="Flow, pressure, and temperature targets across the profile stages">
      <defs><clipPath id="pb-active-stage"><rect x={clipX} y="0" width={clipWidth} height={CHART_HEIGHT} /></clipPath></defs>
      {[12, 9, 6, 3, 0].map((value) => {
        const y = PLOT_TOP + (12 - value) / 12 * (PLOT_BOTTOM - PLOT_TOP)
        return <line key={value} className="pb-chart__tick" x1="0" x2="10" y1={y} y2={y} />
      })}
      <path className="pb-chart__line pb-chart__line--pressure pb-chart__line--muted" d={pressurePath} />
      <path className="pb-chart__line pb-chart__line--flow pb-chart__line--muted" d={flowPath} />
      <path className="pb-chart__line pb-chart__line--temperature pb-chart__line--muted" d={temperaturePath} />
      <g clipPath="url(#pb-active-stage)">
        <path className="pb-chart__line pb-chart__line--pressure" d={pressurePath} />
        <path className="pb-chart__line pb-chart__line--flow" d={flowPath} />
        <path className="pb-chart__line pb-chart__line--temperature" d={temperaturePath} />
      </g>
    </svg>
  </section>
}

function SegmentControl({ value, onChange }: { value: BuilderStage['pump']; onChange: (value: BuilderStage['pump']) => void }) {
  return <div className="pb-segmented pb-segmented--pump" role="group" aria-label="Stage control">
    <button type="button" className={value === 'flow' ? 'is-selected is-flow' : ''} onClick={() => onChange('flow')}>Flow</button>
    <button type="button" className={value === 'pressure' ? 'is-selected is-pressure' : ''} onClick={() => onChange('pressure')}>Pressure</button>
  </div>
}

function TransitionControl({ value, onChange }: { value: BuilderStage['transition']; onChange: (value: BuilderStage['transition']) => void }) {
  return <div className="pb-segmented pb-segmented--choice" role="group" aria-label="Stage transition">
    <button type="button" className={value === 'fast' ? 'is-selected' : ''} onClick={() => onChange('fast')}><img src={builderTransitionFast} alt="" />Fast</button>
    <button type="button" className={value === 'smooth' ? 'is-selected' : ''} onClick={() => onChange('smooth')}><img src={builderTransitionSmooth} alt="" />Smooth</button>
  </div>
}

function SensorControl({ value, onChange }: { value: BuilderStage['sensor']; onChange: (value: BuilderStage['sensor']) => void }) {
  return <div className="pb-segmented pb-segmented--choice" role="group" aria-label="Temperature sensor">
    <button type="button" className={value === 'water' ? 'is-selected' : ''} onClick={() => onChange('water')}>Water</button>
    <button type="button" className={value === 'coffee' ? 'is-selected' : ''} onClick={() => onChange('coffee')}>Coffee</button>
  </div>
}

function Stepper({ label, value, unit, step, min = 0, max = 1000, onChange }: {
  label: string
  value?: number
  unit: string
  step: number
  min?: number
  max?: number
  onChange: (value: number | undefined) => void
}) {
  const enabled = value !== undefined && value > 0
  const change = (direction: -1 | 1) => {
    if (!enabled && direction < 0) return
    const base = enabled ? value : min > 0 ? min : step
    const next = rounded(clamp((base ?? 0) + (enabled ? direction * step : 0), min, max))
    onChange(next <= 0 ? undefined : next)
  }
  return <div className="pb-stepper" aria-label={`${label}, ${formatValue(value)} ${unit}`}>
    <button type="button" onClick={() => change(-1)} aria-label={`Reduce ${label}`}><img src={enabled ? builderStepMinus : builderStepMinusMuted} alt="" /></button>
    <span>{formatValue(value)}{unit && <small>{unit}</small>}</span>
    <button type="button" onClick={() => change(1)} aria-label={`Increase ${label}`}><img src={builderStepPlus} alt="" /></button>
  </div>
}

function ExitControl({ type, stage, onChange }: { type: BuilderExitType; stage: BuilderStage; onChange: (patch: Partial<BuilderStage>) => void }) {
  const value = stage.exit?.type === type ? stage.exit.value : undefined
  return <div className="pb-condition">
    <div className="pb-condition__label"><span>{type === 'flow' ? 'Flow' : 'Pressure'} is <em>above</em></span><img src={builderValueChevron} alt="" /></div>
    <Stepper label={`${type} exit`} value={value} unit={type === 'flow' ? 'ml/s' : 'bar'} step={0.1} onChange={(next) => onChange({ exit: next === undefined ? undefined : { type, condition: 'over', value: next } })} />
  </div>
}

function StageEditorCard({ stage, index, active, onActivate, onChange }: {
  stage: BuilderStage
  index: number
  active: boolean
  onActivate: () => void
  onChange: (patch: Partial<BuilderStage>) => void
}) {
  const setPump = (pump: BuilderStage['pump']) => onChange({
    pump,
    target: pump === stage.pump ? stage.target : 6,
    limiter: stage.limiter ? { ...stage.limiter, type: pump === 'pressure' ? 'flow' : 'pressure' } : undefined,
  })
  const limiterLabel = stage.pump === 'pressure' ? 'Max flow' : 'Max pressure'
  const limiterUnit = stage.pump === 'pressure' ? 'ml/s' : 'bar'
  const limiterValue = stage.limiter?.value

  return <article className={active ? 'pb-stage is-active' : 'pb-stage'} onClick={onActivate} aria-label={`Stage ${index + 1}: ${stage.name}`}>
    <header>
      <input aria-label={`Stage ${index + 1} name`} value={stage.name} onChange={(event) => onChange({ name: event.target.value })} />
      <Stepper label="Duration" value={stage.seconds} unit="s" step={1} min={1} max={120} onChange={(seconds) => onChange({ seconds: seconds ?? 1 })} />
    </header>
    <div className="pb-stage__control-row">
      <SegmentControl value={stage.pump} onChange={setPump} />
      <Stepper label={`${stage.pump} target`} value={stage.target} unit={stage.pump === 'pressure' ? 'bar' : 'ml/s'} step={0.1} max={stage.pump === 'pressure' ? 12 : 8} onChange={(target) => onChange({ target: target ?? 0 })} />
    </div>
    <div className="pb-stage__row pb-stage__row--transition"><span>Transition</span><TransitionControl value={stage.transition} onChange={(transition) => onChange({ transition })} /></div>
    <div className="pb-stage__row pb-stage__row--limiter"><span>{limiterLabel}</span><Stepper label={limiterLabel} value={limiterValue} unit={limiterUnit} step={0.1} max={stage.pump === 'pressure' ? 8 : 12} onChange={(value) => onChange({ limiter: value === undefined ? undefined : { type: stage.pump === 'pressure' ? 'flow' : 'pressure', value, range: stage.limiter?.range ?? 0.4 } })} /></div>
    <div className="pb-stage__divider pb-stage__divider--upper" />
    <div className="pb-stage__row pb-stage__row--temperature"><span>Temperature</span><Stepper label="Temperature" value={stage.temperature} unit="°" step={0.5} min={80} max={100} onChange={(temperature) => onChange({ temperature: temperature ?? 80 })} /></div>
    <div className="pb-stage__row pb-stage__row--sensor"><span>Measure from</span><SensorControl value={stage.sensor} onChange={(sensor) => onChange({ sensor })} /></div>
    <div className="pb-stage__divider pb-stage__divider--lower" />
    <section className="pb-stage__conditions" aria-label="Move to next stage if">
      <h2>Move to next stage if</h2>
      <div className="pb-condition-grid">
        <ExitControl type="flow" stage={stage} onChange={onChange} />
        <ExitControl type="pressure" stage={stage} onChange={onChange} />
        <div className="pb-condition">
          <div className="pb-condition__label"><span>Yield</span><img src={builderValueChevron} alt="" /></div>
          <Stepper label="Stage yield" value={stage.weight} unit="g" step={0.1} onChange={(weight) => onChange({ weight })} />
        </div>
        <div className="pb-condition">
          <div className="pb-condition__label"><span>Volume</span><img src={builderValueChevron} alt="" /></div>
          <Stepper label="Stage volume" value={stage.volume > 0 ? stage.volume : undefined} unit="ml" step={1} onChange={(volume) => onChange({ volume: volume ?? 0 })} />
        </div>
      </div>
    </section>
  </article>
}

export function ProfileBuilderScreen({ onClose }: { onClose: () => void }) {
  const openAdjustment = useValueAdjustment()
  const [draft, setDraft] = useState(createDefaultProfileDraft)
  const [activeStage, setActiveStage] = useState(0)
  const [category, setCategory] = useState<string | undefined>()
  const categories = useMemo(() => [undefined, 'Espresso', 'Filter', 'Tea', 'Cleaning'] as const, [])

  const updateDraft = <Key extends keyof ProfileDraft>(key: Key, value: ProfileDraft[Key]) => setDraft((current) => ({ ...current, [key]: value }))
  const updateStage = (index: number, patch: Partial<BuilderStage>) => setDraft((current) => ({ ...current, stages: current.stages.map((stage, stageIndex) => stageIndex === index ? { ...stage, ...patch } : stage) }))
  const addStage = () => {
    const index = draft.stages.length
    updateDraft('stages', [...draft.stages, nextBuilderStage(index)])
    setActiveStage(index)
  }
  const cycleCategory = () => {
    const index = categories.findIndex((item) => item === category)
    setCategory(categories[(index + 1) % categories.length])
  }
  const cycleType = () => {
    const types: ProfileDraft['beverageType'][] = ['espresso', 'pourover', 'manual', 'cleaning']
    const index = types.indexOf(draft.beverageType)
    updateDraft('beverageType', types[(index + 1) % types.length])
  }
  const editTargetYield = () => openAdjustment({
    label: 'Target yield',
    value: draft.targetWeight ?? 0,
    unit: 'g',
    ...VALUE_ADJUSTMENTS.targetYield,
    suggestionKey: 'targetYield',
    onSave: (targetWeight) => updateDraft('targetWeight', targetWeight > 0 ? targetWeight : undefined),
  })
  return <main className="profile-builder-screen pb-screen">
    <header className="pb-topbar">
      <div className="pb-topbar__identity">
        <input aria-label="Profile name" value={draft.title} onChange={(event) => updateDraft('title', event.target.value)} />
        <button className="pb-category" type="button" onClick={cycleCategory}>{category ?? 'Category (optional)'}<img src={builderCategoryChevron} alt="" /></button>
      </div>
      <div className="pb-topbar__metadata">
        <button type="button" className="pb-meta" onClick={cycleType}><span>Type <img src={builderValueChevron} alt="" /></span><strong>{draft.beverageType === 'pourover' ? 'Pour over' : `${draft.beverageType[0].toUpperCase()}${draft.beverageType.slice(1)}`}</strong></button>
        <button type="button" className="pb-meta" onClick={editTargetYield}><span>Target yield <img src={builderValueChevron} alt="" /></span><strong>{formatValue(draft.targetWeight)} <small>g</small></strong></button>
      </div>
      <div className="pb-topbar__actions">
        <button className="pb-cancel" type="button" onClick={onClose}>Cancel</button>
        <button className="pb-save" type="button">Save</button>
      </div>
    </header>
    <BuilderChart draft={draft} activeStage={activeStage} />
    <section className="pb-stage-strip" aria-label="Editable brew stages">
      {draft.stages.map((stage, index) => <StageEditorCard key={stage.id} stage={stage} index={index} active={index === activeStage} onActivate={() => setActiveStage(index)} onChange={(patch) => updateStage(index, patch)} />)}
      <button className="pb-add-stage" type="button" aria-label="Add stage" onClick={addStage}>
        <span><img src={builderStepPlus} alt="" /></span>
        <strong>Add stage</strong>
      </button>
    </section>
  </main>
}
