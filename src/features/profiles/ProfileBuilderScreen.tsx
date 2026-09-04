import { useEffect, useMemo, useRef, useState } from 'react'
import builderCategoryChevron from '../../assets/figma/builder-category-chevron.svg'
import builderStepMinus from '../../assets/figma/builder-step-minus.svg'
import builderStepMinusMuted from '../../assets/figma/builder-step-minus-muted.svg'
import builderStepPlus from '../../assets/figma/builder-step-plus.svg'
import builderTransitionFast from '../../assets/figma/builder-transition-fast.svg'
import builderTransitionSmooth from '../../assets/figma/builder-transition-smooth.svg'
import builderValueChevron from '../../assets/figma/builder-value-chevron.svg'
import { useValueAdjustment } from '../../components/ValueAdjustment/ValueAdjustmentContext'
import type { DecaidProfile, DecaidProfileRecord } from '../../api/decaid/types'
import type { ProfileTargetPoint } from '../../domain/brewing'
import { VALUE_ADJUSTMENTS } from '../../domain/valueAdjustments'
import { ChartLegend } from '../brew/ChartLegend'
import { ChartStageMarkers } from '../brew/ChartStageMarkers'
import type { ChartStageMarker } from '../brew/ChartStageMarkers'
import { removeOverlappingFocusedTimeTicks, shouldShowTimelineLabel } from '../brew/chartTimeTicks'
import { builderTargetPoints, createDefaultProfileDraft, nextBuilderStage, profileDraftFromDecaidProfile, profileDraftToDecaidProfile, profileMaximumDurationMs } from './profileBuilderModel'
import type { BuilderExitType, BuilderStage, ProfileDraft } from './profileBuilderModel'

const CHART_WIDTH = 1090
const CHART_HEIGHT = 290
const PLOT_TOP = 58
const PLOT_BOTTOM = 260

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const rounded = (value: number) => Math.round(value * 10) / 10
const formatValue = (value: number | null | undefined) => value === null || value === undefined || value <= 0 ? '-' : Number.isInteger(value) ? String(value) : value.toFixed(1)

const pathFor = (points: ProfileTargetPoint[], key: 'pressure' | 'flow' | 'temperature', maximumDurationMs: number, minimum: number, maximum: number) => points.reduce((path, point, index) => {
  const x = maximumDurationMs > 0 ? point.elapsedMs / maximumDurationMs * CHART_WIDTH : 0
  const value = point[key] ?? minimum
  const y = PLOT_BOTTOM - clamp((value - minimum) / (maximum - minimum), 0, 1) * (PLOT_BOTTOM - PLOT_TOP)
  return `${path}${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
}, '')

function BuilderChart({ draft, activeStage }: { draft: ProfileDraft; activeStage: number | null }) {
  const points = builderTargetPoints(draft.stages)
  const maximumDurationMs = Math.max(1, profileMaximumDurationMs(draft.stages))
  const stageStart = activeStage === null ? 0 : profileMaximumDurationMs(draft.stages.slice(0, activeStage))
  const stageEnd = activeStage === null ? maximumDurationMs : stageStart + profileMaximumDurationMs(draft.stages.slice(activeStage, activeStage + 1))
  const clipX = stageStart / maximumDurationMs * CHART_WIDTH
  const clipWidth = Math.max(1, (stageEnd - stageStart) / maximumDurationMs * CHART_WIDTH)
  const pressurePath = pathFor(points, 'pressure', maximumDurationMs, 0, 12)
  const flowPath = pathFor(points, 'flow', maximumDurationMs, 0, 12)
  const temperaturePath = pathFor(points, 'temperature', maximumDurationMs, 70, 100)
  const stageMarkers = draft.stages.reduce<ChartStageMarker[]>((markers, stage) => {
    const startMs = markers.at(-1)?.endMs ?? 0
    return [...markers, { key: stage.id, name: stage.name, startMs, endMs: startMs + profileMaximumDurationMs([stage]) }]
  }, [])

  const intervalTicks = Array.from({ length: Math.floor(maximumDurationMs / 5_000) }, (_, index) => (index + 1) * 5_000)
  const gridTimeTicks = [0, ...intervalTicks, ...(maximumDurationMs % 5_000 ? [maximumDurationMs] : [])]
  const boundaryTicks = activeStage === null ? [] : [stageStart, stageEnd]
  const labelCandidates = [...new Set([...gridTimeTicks, ...boundaryTicks])].sort((left, right) => left - right)
  const timeLabels = removeOverlappingFocusedTimeTicks(labelCandidates.filter((elapsedMs) => shouldShowTimelineLabel(
    elapsedMs,
    0,
    maximumDurationMs,
    elapsedMs === 0 || elapsedMs === maximumDurationMs || boundaryTicks.includes(elapsedMs),
  )).map((elapsedMs) => {
    const seconds = elapsedMs / 1000
    return { offsetMs: elapsedMs, x: elapsedMs / maximumDurationMs * CHART_WIDTH, label: `${Number.isInteger(seconds) ? seconds : seconds.toFixed(1)}s` }
  }))

  return <section className={`pb-chart${activeStage === null ? '' : ' is-focused'}`} aria-label="Profile target preview">
    <ChartLegend mode="profile" showWeight={false} className="pb-chart__legend" />
    <div className="pb-chart__axis" aria-hidden="true">
      <span>bar / ml/s</span>
      {[12, 9, 6, 3, 0].map((value) => <i key={value} style={{ top: `${(PLOT_TOP + (12 - value) / 12 * (PLOT_BOTTOM - PLOT_TOP)) / CHART_HEIGHT * 100}%` }}>{value}</i>)}
    </div>
    <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} preserveAspectRatio="none" role="img" aria-label="Flow, pressure, and temperature targets across the profile stages">
      <defs><clipPath id="pb-active-stage"><rect x={clipX} y="0" width={clipWidth} height={CHART_HEIGHT} /></clipPath></defs>
      <ChartStageMarkers stages={stageMarkers} highlightedKey={activeStage === null ? undefined : draft.stages[activeStage]?.id} xForElapsedMs={(elapsedMs) => elapsedMs / maximumDurationMs * CHART_WIDTH} plotLeft={0} plotRight={CHART_WIDTH} top={34} bottom={58} />
      {[12, 9, 6, 3, 0].map((value) => {
        const y = PLOT_TOP + (12 - value) / 12 * (PLOT_BOTTOM - PLOT_TOP)
        return <line key={value} className="pb-chart__tick" x1="0" x2="10" y1={y} y2={y} />
      })}
      {gridTimeTicks.map((elapsedMs) => <line key={`time-grid-${elapsedMs}`} className="pb-chart__time-grid" x1={elapsedMs / maximumDurationMs * CHART_WIDTH} x2={elapsedMs / maximumDurationMs * CHART_WIDTH} y1={PLOT_TOP} y2={PLOT_BOTTOM} />)}
      {activeStage !== null && <>
        <rect className="pb-chart__focus" x={clipX} y={PLOT_TOP} width={clipWidth} height={PLOT_BOTTOM - PLOT_TOP} />
      </>}
      <path className={`pb-chart__line pb-chart__line--pressure${activeStage === null ? '' : ' pb-chart__line--muted'}`} d={pressurePath} />
      <path className={`pb-chart__line pb-chart__line--flow${activeStage === null ? '' : ' pb-chart__line--muted'}`} d={flowPath} />
      <path className={`pb-chart__line pb-chart__line--temperature${activeStage === null ? '' : ' pb-chart__line--muted'}`} d={temperaturePath} />
      {activeStage !== null && <g clipPath="url(#pb-active-stage)">
          <path className="pb-chart__line pb-chart__line--pressure" d={pressurePath} />
          <path className="pb-chart__line pb-chart__line--flow" d={flowPath} />
          <path className="pb-chart__line pb-chart__line--temperature" d={temperaturePath} />
        </g>}
      {timeLabels.map((tick) => <text key={`time-label-${tick.offsetMs}`} className="pb-chart__time-label" x={tick.x} y={PLOT_BOTTOM + 24} textAnchor="middle">{tick.label}</text>)}
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
  value?: number | null
  unit: string
  step: number
  min?: number
  max?: number
  onChange: (value: number | undefined) => void
}) {
  const enabled = typeof value === 'number' && value > 0
  const change = (direction: -1 | 1) => {
    if (!enabled && direction < 0) return
    const base = enabled && typeof value === 'number' ? value : min > 0 ? min : step
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

function StageEditorCard({ stage, index, active, onActivate, onChange, cardRef }: {
  stage: BuilderStage
  index: number
  active: boolean
  onActivate: () => void
  onChange: (patch: Partial<BuilderStage>) => void
  cardRef: (element: HTMLElement | null) => void
}) {
  const setPump = (pump: BuilderStage['pump']) => onChange({
    pump,
    target: pump === stage.pump ? stage.target : 6,
    limiter: stage.limiter ? { ...stage.limiter, type: pump === 'pressure' ? 'flow' : 'pressure' } : undefined,
  })
  const limiterLabel = stage.pump === 'pressure' ? 'Max flow' : 'Max pressure'
  const limiterUnit = stage.pump === 'pressure' ? 'ml/s' : 'bar'
  const limiterValue = stage.limiter?.value
  const targetUnit = stage.pump === 'pressure' ? 'bar' : 'ml/s'
  const stageNumber = index + 1
  const exitSummary = stage.exit?.value
    ? `${stage.exit.type === 'pressure' ? 'Pressure' : 'Flow'} ${stage.exit.condition === 'under' ? 'under' : 'over'} ${formatValue(stage.exit.value)}`
    : stage.weight
      ? `Yield ${formatValue(stage.weight)} g`
      : stage.volume
        ? `Volume ${formatValue(stage.volume)} ml`
        : 'Duration only'

  if (!active) return <article ref={cardRef} className="pb-stage is-collapsed" role="button" tabIndex={0} onClick={onActivate} onKeyDown={(event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    onActivate()
  }} aria-expanded="false" aria-label={`Open stage ${index + 1}: ${stage.name}`}>
    <span className="pb-stage__connector" aria-hidden="true">›</span>
    <header className="pb-stage__summary-header">
      <b>{stageNumber}</b>
      <span><strong>{stage.name}</strong></span>
      <em>{formatValue(stage.seconds)}<small>s</small></em>
    </header>
    <span className="pb-stage__summary-grid">
      <span><small>Control</small><strong>{stage.pump === 'pressure' ? 'Pressure' : 'Flow'} · {formatValue(stage.target)} {targetUnit}</strong></span>
      <span><small>Temperature</small><strong>{formatValue(stage.temperature)}° · {stage.sensor === 'water' ? 'Water' : 'Coffee'}</strong></span>
      <span className="pb-stage__summary-exit"><small>Moves on by</small><strong>{exitSummary}</strong></span>
    </span>
  </article>

  return <article ref={cardRef} className="pb-stage is-active" onClick={(event) => {
    if ((event.target as HTMLElement).closest('button,input')) return
    onActivate()
  }} aria-expanded="true" aria-label={`Stage ${index + 1}: ${stage.name}`}>
    <span className="pb-stage__connector" aria-hidden="true">›</span>
    <header className="pb-stage__active-header">
      <b>{stageNumber}</b>
      <div><input aria-label={`Stage ${index + 1} name`} value={stage.name} onChange={(event) => onChange({ name: event.target.value })} /></div>
      <div className="pb-stage__duration"><small>Maximum duration</small><Stepper label="Duration" value={stage.seconds} unit="s" step={1} min={1} max={120} onChange={(seconds) => onChange({ seconds: seconds ?? 1 })} /></div>
    </header>
    <div className="pb-stage__editor-grid">
      <section className="pb-stage__group pb-stage__group--control" aria-label="Stage control">
        <h2>Control</h2>
        <SegmentControl value={stage.pump} onChange={setPump} />
        <div className="pb-stage__row"><span>Target</span><Stepper label={`${stage.pump} target`} value={stage.target} unit={targetUnit} step={0.1} max={stage.pump === 'pressure' ? 12 : 8} onChange={(target) => onChange({ target: target ?? 0 })} /></div>
        <div className="pb-stage__row"><span>Transition</span><TransitionControl value={stage.transition} onChange={(transition) => onChange({ transition })} /></div>
        <div className="pb-stage__row"><span>{limiterLabel}</span><Stepper label={limiterLabel} value={limiterValue} unit={limiterUnit} step={0.1} max={stage.pump === 'pressure' ? 8 : 12} onChange={(value) => onChange({ limiter: value === undefined ? undefined : { type: stage.pump === 'pressure' ? 'flow' : 'pressure', value, range: stage.limiter?.range ?? 0.4 } })} /></div>
      </section>
      <section className="pb-stage__group pb-stage__group--temperature" aria-label="Stage temperature">
        <h2>Temperature</h2>
        <div className="pb-stage__temperature-value"><Stepper label="Temperature" value={stage.temperature} unit="°" step={0.5} min={80} max={100} onChange={(temperature) => onChange({ temperature: temperature ?? 80 })} /></div>
        <div className="pb-stage__row"><span>Measure from</span><SensorControl value={stage.sensor} onChange={(sensor) => onChange({ sensor })} /></div>
      </section>
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
    </div>
  </article>
}

interface ProfileBuilderScreenProps {
  onClose: () => void
  initialRecord?: DecaidProfileRecord
  existingTitles?: string[]
  onSave?: (profile: DecaidProfile, parentId?: string, metadata?: Record<string, unknown> | null) => Promise<boolean>
}

export function ProfileBuilderScreen({ onClose, initialRecord, existingTitles = [], onSave }: ProfileBuilderScreenProps) {
  const openAdjustment = useValueAdjustment()
  const [draft, setDraft] = useState(() => initialRecord?.profile?.steps?.length
    ? profileDraftFromDecaidProfile(initialRecord.profile, { mode: 'edit', sourceProfileId: initialRecord.id, sourceMetadata: initialRecord.metadata, existingTitles })
    : createDefaultProfileDraft())
  const [activeStage, setActiveStage] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const stageStripRef = useRef<HTMLElement>(null)
  const stageCards = useRef(new Map<number, HTMLElement>())
  const categories = useMemo(() => [undefined, 'Espresso', 'Filter', 'Tea', 'Cleaning'] as const, [])

  useEffect(() => {
    if (activeStage === null) return
    const strip = stageStripRef.current
    const card = stageCards.current.get(activeStage)
    if (!strip || !card) return
    const alignActiveCard = () => {
      const inset = 24
      const cardLeft = card.offsetLeft
      const cardRight = cardLeft + card.offsetWidth
      const lastStage = draft.stages.length - 1
      const target = activeStage === 0
        ? cardLeft - inset
        : activeStage === lastStage
          ? cardRight - strip.clientWidth + inset
          : cardLeft + card.offsetWidth / 2 - strip.clientWidth / 2
      const maxScroll = Math.max(0, strip.scrollWidth - strip.clientWidth)
      strip.scrollTo({ left: clamp(target, 0, maxScroll), behavior: 'smooth' })
    }
    const animationFrame = requestAnimationFrame(alignActiveCard)
    const transitionFallback = window.setTimeout(alignActiveCard, 460)
    const handleTransitionEnd = (event: TransitionEvent) => {
      if (event.target === card && (event.propertyName === 'width' || event.propertyName === 'flex-basis')) alignActiveCard()
    }
    card.addEventListener('transitionend', handleTransitionEnd)
    window.addEventListener('resize', alignActiveCard)
    return () => {
      cancelAnimationFrame(animationFrame)
      window.clearTimeout(transitionFallback)
      card.removeEventListener('transitionend', handleTransitionEnd)
      window.removeEventListener('resize', alignActiveCard)
    }
  }, [activeStage, draft.stages.length])

  const updateDraft = <Key extends keyof ProfileDraft>(key: Key, value: ProfileDraft[Key]) => setDraft((current) => ({ ...current, [key]: value }))
  const updateStage = (index: number, patch: Partial<BuilderStage>) => setDraft((current) => ({ ...current, stages: current.stages.map((stage, stageIndex) => stageIndex === index ? { ...stage, ...patch } : stage) }))
  const addStage = () => {
    const index = draft.stages.length
    updateDraft('stages', [...draft.stages, nextBuilderStage(index)])
    setActiveStage(index)
  }
  const cycleCategory = () => {
    const index = categories.findIndex((item) => item === draft.category)
    updateDraft('category', categories[(index + 1) % categories.length])
  }
  const cycleType = () => {
    const types: ProfileDraft['beverageType'][] = ['espresso', 'pourover', 'manual', 'cleaning', 'calibrate']
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
  const saveProfile = async () => {
    if (!onSave || saving) return
    setSaving(true)
    setSaveError(null)
    try {
      const saved = await onSave(profileDraftToDecaidProfile(draft), draft.sourceProfileId, draft.sourceMetadata)
      if (saved) onClose()
      else setSaveError('This profile could not be saved.')
    } catch {
      setSaveError('This profile could not be saved.')
    } finally {
      setSaving(false)
    }
  }
  const toggleStage = (index: number) => setActiveStage((current) => current === index ? null : index)

  return <main className={`profile-builder-screen pb-screen${activeStage === null ? '' : ' has-active-stage'}`}>
    <header className="pb-topbar">
      <div className="pb-topbar__identity">
        <input aria-label="Profile name" value={draft.title} onChange={(event) => updateDraft('title', event.target.value)} />
        <button className="pb-category" type="button" onClick={cycleCategory}>{draft.category ?? 'Category (optional)'}<img src={builderCategoryChevron} alt="" /></button>
      </div>
      <div className="pb-topbar__metadata">
        <button type="button" className="pb-meta" onClick={cycleType}><span>Type <img src={builderValueChevron} alt="" /></span><strong>{draft.beverageType === 'pourover' ? 'Pour over' : `${draft.beverageType[0].toUpperCase()}${draft.beverageType.slice(1)}`}</strong></button>
        <button type="button" className="pb-meta" onClick={editTargetYield}><span>Target yield <img src={builderValueChevron} alt="" /></span><strong>{formatValue(draft.targetWeight)} <small>g</small></strong></button>
      </div>
      <div className="pb-topbar__actions">
        <button className="pb-cancel" type="button" onClick={onClose}>Cancel</button>
        <button className="pb-save" type="button" disabled={saving || !draft.title.trim() || !draft.stages.length} onClick={() => void saveProfile()}>{saving ? 'Saving…' : 'Save'}</button>
      </div>
      {saveError && <p className="pb-save-error" role="alert">{saveError}</p>}
    </header>
    <BuilderChart draft={draft} activeStage={activeStage} />
    <section ref={stageStripRef} className="pb-stage-strip" aria-label="Editable brew stages">
      {draft.stages.map((stage, index) => <StageEditorCard key={stage.id} cardRef={(element) => { if (element) stageCards.current.set(index, element); else stageCards.current.delete(index) }} stage={stage} index={index} active={index === activeStage} onActivate={() => toggleStage(index)} onChange={(patch) => updateStage(index, patch)} />)}
      <button className="pb-add-stage" type="button" aria-label="Add stage" onClick={addStage}>
        <span><img src={builderStepPlus} alt="" /></span>
        <strong>Add stage</strong>
      </button>
    </section>
  </main>
}
