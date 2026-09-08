import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import builderCategoryChevron from '../../assets/figma/builder-category-chevron.svg'
import builderCardClose from '../../assets/figma/builder-card-close.svg'
import builderCoffeeSource from '../../assets/figma/builder-coffee-source.svg'
import builderCoffeeSourceMuted from '../../assets/figma/builder-coffee-source-muted.svg'
import builderStageDelete from '../../assets/figma/builder-stage-delete.svg'
import builderStageDrag from '../../assets/figma/builder-stage-drag.svg'
import builderStageDuplicate from '../../assets/figma/builder-stage-duplicate.svg'
import builderStageNumber from '../../assets/figma/builder-stage-number.svg'
import builderStepMinus from '../../assets/figma/builder-step-minus.svg'
import builderStepMinusMuted from '../../assets/figma/builder-step-minus-muted.svg'
import builderStepPlus from '../../assets/figma/builder-step-plus.svg'
import builderTransitionFast from '../../assets/figma/builder-transition-fast.svg'
import builderTransitionFastActive from '../../assets/figma/builder-transition-fast-active.svg'
import builderTransitionSmooth from '../../assets/figma/builder-transition-smooth.svg'
import builderTransitionSmoothActive from '../../assets/figma/builder-transition-smooth-active.svg'
import builderValueChevron from '../../assets/figma/builder-value-chevron.svg'
import builderWaterSource from '../../assets/figma/builder-water-source.svg'
import builderWaterSourceActive from '../../assets/figma/builder-water-source-active.svg'
import skipNext from '../../assets/figma/skip-next.svg'
import { useValueAdjustment } from '../../components/ValueAdjustment/ValueAdjustmentContext'
import type { DecaidProfile, DecaidProfileRecord } from '../../api/decaid/types'
import type { ProfileTargetPoint } from '../../domain/brewing'
import { VALUE_ADJUSTMENTS } from '../../domain/valueAdjustments'
import { ChartLegend } from '../brew/ChartLegend'
import { ChartStageMarkers } from '../brew/ChartStageMarkers'
import type { ChartStageMarker } from '../brew/ChartStageMarkers'
import { builderPumpMemory, builderTargetPoints, createDefaultProfileDraft, duplicateBuilderStage, moveBuilderStage, nextBuilderStage, profileDraftFromDecaidProfile, profileDraftToDecaidProfile, profileMaximumDurationMs, stageIndexAfterMove, switchBuilderPump, volumeCountStartAfterDelete } from './profileBuilderModel'
import type { BuilderExitType, BuilderStage, ProfileDraft } from './profileBuilderModel'
import { nextBuilderStepperValue } from './profileBuilderStepper'
import type { BuilderStepperDirection } from './profileBuilderStepper'
import { issueSummary, validateProfileDraft } from './profileBuilderValidation'
import type { ProfileBuilderIssue } from './profileBuilderValidation'

const CHART_WIDTH = 1090
const CHART_HEIGHT = 290
const PLOT_TOP = 58
const PLOT_BOTTOM = 282

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const formatValue = (value: number | null | undefined) => value === null || value === undefined || value <= 0 ? '-' : Number.isInteger(value) ? String(value) : value.toFixed(1)

const pathFor = (points: ProfileTargetPoint[], key: 'pressure' | 'flow' | 'temperature', maximumDurationMs: number, minimum: number, maximum: number) => points.reduce((path, point, index) => {
  const x = point.elapsedMs / maximumDurationMs * CHART_WIDTH
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
  const stageBoundaries = stageMarkers.slice(0, -1).map((stage) => stage.endMs)

  return <section className={`pb-chart${activeStage === null ? '' : ' is-focused'}`} aria-label="Profile target preview">
    <ChartLegend mode="profile" showWeight={false} className="pb-chart__legend" />
    <div className="pb-chart__axis" aria-hidden="true">
      <span>bar / ml/s</span>
      {[12, 9, 6, 3, 0].map((value) => <i key={value} style={{ top: `${(PLOT_TOP + (12 - value) / 12 * (PLOT_BOTTOM - PLOT_TOP)) / CHART_HEIGHT * 100}%` }}>{value}</i>)}
    </div>
    <ChartStageMarkers stages={stageMarkers} highlightedKey={activeStage === null ? undefined : draft.stages[activeStage]?.id} xForElapsedMs={(elapsedMs) => elapsedMs / maximumDurationMs * CHART_WIDTH} plotLeft={0} plotRight={CHART_WIDTH} />
    <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} preserveAspectRatio="none" role="img" aria-label="Flow, pressure, and temperature targets across the profile stages">
      <defs><clipPath id="pb-active-stage"><rect x={clipX} y="0" width={clipWidth} height={CHART_HEIGHT} /></clipPath></defs>
      {[12, 9, 6, 3, 0].map((value) => {
        const y = PLOT_TOP + (12 - value) / 12 * (PLOT_BOTTOM - PLOT_TOP)
        return <line key={value} className="pb-chart__tick" x1="0" x2="10" y1={y} y2={y} />
      })}
      {stageBoundaries.map((elapsedMs) => <line key={`stage-boundary-${elapsedMs}`} className="pb-chart__stage-separator" x1={elapsedMs / maximumDurationMs * CHART_WIDTH} x2={elapsedMs / maximumDurationMs * CHART_WIDTH} y1={PLOT_TOP} y2={PLOT_BOTTOM} />)}
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
    </svg>
  </section>
}

function SegmentControl({ value, onChange }: { value: BuilderStage['pump']; onChange: (value: BuilderStage['pump']) => void }) {
  return <div className="pb-segmented pb-segmented--pump" role="group" aria-label="Stage control">
    <button type="button" className={value === 'pressure' ? 'is-selected is-pressure' : ''} onClick={() => onChange('pressure')}>Pressure</button>
    <button type="button" className={value === 'flow' ? 'is-selected is-flow' : ''} onClick={() => onChange('flow')}>Flow</button>
  </div>
}

function TransitionControl({ value, onChange }: { value: BuilderStage['transition']; onChange: (value: BuilderStage['transition']) => void }) {
  return <div className="pb-segmented pb-segmented--choice" role="group" aria-label="Stage transition">
    <button type="button" className={value === 'fast' ? 'is-selected' : ''} onClick={() => onChange('fast')}><img src={value === 'fast' ? builderTransitionFastActive : builderTransitionFast} alt="" />Fast</button>
    <button type="button" className={value === 'smooth' ? 'is-selected' : ''} onClick={() => onChange('smooth')}><img src={value === 'smooth' ? builderTransitionSmoothActive : builderTransitionSmooth} alt="" />Smooth</button>
  </div>
}

function SensorControl({ value, onChange }: { value: BuilderStage['sensor']; onChange: (value: BuilderStage['sensor']) => void }) {
  return <div className="pb-segmented pb-segmented--choice" role="group" aria-label="Temperature sensor">
    <button type="button" className={value === 'coffee' ? 'is-selected' : ''} onClick={() => onChange('coffee')}><img src={value === 'coffee' ? builderCoffeeSource : builderCoffeeSourceMuted} alt="" />Coffee</button>
    <button type="button" className={value === 'water' ? 'is-selected' : ''} onClick={() => onChange('water')}><img src={value === 'water' ? builderWaterSourceActive : builderWaterSource} alt="" />Water</button>
  </div>
}

function Stepper({ label, value, unit, step, min = 0, max = 1000, disabled = false, onChange, onOpen }: {
  label: string
  value?: number | null
  unit: string
  step: number
  min?: number
  max?: number
  disabled?: boolean
  onChange: (value: number | undefined) => void
  onOpen?: () => void
}) {
  const enabled = !disabled && typeof value === 'number' && value > 0
  const valueRef = useRef(value)
  const holdTimer = useRef<ReturnType<typeof window.setTimeout> | null>(null)
  const repeatTimer = useRef<ReturnType<typeof window.setInterval> | null>(null)
  const press = useRef<{ pointerId: number; held: boolean } | null>(null)
  useEffect(() => { valueRef.current = value }, [value])
  useEffect(() => () => {
    if (holdTimer.current !== null) window.clearTimeout(holdTimer.current)
    if (repeatTimer.current !== null) window.clearInterval(repeatTimer.current)
  }, [])

  const change = (direction: BuilderStepperDirection, wholeUnit: boolean) => {
    const next = nextBuilderStepperValue(valueRef.current, direction, step, min, max, wholeUnit)
    valueRef.current = next
    onChange(next)
  }
  const clearPressTimers = () => {
    if (holdTimer.current !== null) window.clearTimeout(holdTimer.current)
    if (repeatTimer.current !== null) window.clearInterval(repeatTimer.current)
    holdTimer.current = null
    repeatTimer.current = null
  }
  const beginPress = (event: ReactPointerEvent<HTMLButtonElement>, direction: BuilderStepperDirection) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    clearPressTimers()
    press.current = { pointerId: event.pointerId, held: false }
    holdTimer.current = window.setTimeout(() => {
      if (!press.current || press.current.pointerId !== event.pointerId) return
      press.current.held = true
      change(direction, true)
      repeatTimer.current = window.setInterval(() => change(direction, true), 160)
    }, 420)
  }
  const endPress = (event: ReactPointerEvent<HTMLButtonElement>, direction: BuilderStepperDirection, cancelled = false) => {
    if (!press.current || press.current.pointerId !== event.pointerId) return
    event.preventDefault()
    const held = press.current.held
    clearPressTimers()
    press.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    if (!held && !cancelled) change(direction, false)
  }
  return <div className={`pb-stepper${disabled ? ' is-disabled' : ''}`} aria-disabled={disabled} aria-label={`${label}, ${formatValue(value)} ${unit}`}>
    <button
      type="button"
      disabled={!enabled}
      onClick={(event) => { if (event.detail === 0) change(-1, false) }}
      onPointerDown={(event) => beginPress(event, -1)}
      onPointerUp={(event) => endPress(event, -1)}
      onPointerCancel={(event) => endPress(event, -1, true)}
      onLostPointerCapture={(event) => endPress(event, -1, true)}
      onContextMenu={(event) => event.preventDefault()}
      aria-label={`Reduce ${label}; hold for whole units`}
    ><img src={enabled ? builderStepMinus : builderStepMinusMuted} alt="" /></button>
    <span
      className={onOpen && !disabled ? 'pb-stepper__value is-adjustable' : 'pb-stepper__value'}
      role={onOpen && !disabled ? 'button' : undefined}
      tabIndex={onOpen && !disabled ? 0 : undefined}
      onClick={onOpen && !disabled ? (event) => { event.stopPropagation(); onOpen() } : undefined}
      onKeyDown={onOpen && !disabled ? (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        event.stopPropagation()
        onOpen()
      } : undefined}
      aria-label={onOpen && !disabled ? `Open ${label} fullscreen adjustment` : undefined}
    >{formatValue(value)}{unit && <small>{unit}</small>}</span>
    <button
      type="button"
      disabled={disabled}
      onClick={(event) => { if (event.detail === 0) change(1, false) }}
      onPointerDown={(event) => beginPress(event, 1)}
      onPointerUp={(event) => endPress(event, 1)}
      onPointerCancel={(event) => endPress(event, 1, true)}
      onLostPointerCapture={(event) => endPress(event, 1, true)}
      onContextMenu={(event) => event.preventDefault()}
      aria-label={`Increase ${label}; hold for whole units`}
    ><img src={builderStepPlus} alt="" /></button>
  </div>
}

function ExitControl({ type, stage, onChange }: { type: BuilderExitType; stage: BuilderStage; onChange: (patch: Partial<BuilderStage>) => void }) {
  const openAdjustment = useValueAdjustment()
  const value = stage.exit?.type === type ? stage.exit.value : undefined
  const label = `Move on ${type}`
  const comparisonLabel = type === 'flow' ? 'Flow' : 'Pressure'
  const [condition, setCondition] = useState<'over' | 'under'>(() => stage.exit?.type === type ? stage.exit.condition : 'over')
  const selectedCondition = stage.exit?.type === type ? stage.exit.condition : condition
  const changeCondition = (next: 'over' | 'under') => {
    setCondition(next)
    if (stage.exit?.type === type) onChange({ exit: { ...stage.exit, condition: next } })
  }
  const definition = type === 'flow' ? VALUE_ADJUSTMENTS.builderFlow : VALUE_ADJUSTMENTS.builderPressure
  const unit = type === 'flow' ? 'ml/s' : 'bar'
  const openThresholdAdjustment = () => openAdjustment({
    label,
    value: value ?? 0,
    unit,
    ...definition,
    suggestionKey: type === 'flow' ? 'builderFlow' : 'builderPressure',
    selectedVariantId: selectedCondition,
    variants: (['over', 'under'] as const).map((variantCondition) => ({
      id: variantCondition,
      label: `${comparisonLabel} ${variantCondition === 'over' ? '>' : '<'}`,
      value: value ?? 0,
      unit,
      ...definition,
      suggestionKey: type === 'flow' ? 'builderFlow' as const : 'builderPressure' as const,
    })),
    onSave: (next, variantId) => {
      const nextCondition = variantId === 'under' ? 'under' : 'over'
      setCondition(nextCondition)
      onChange({ exit: { type, condition: nextCondition, value: next } })
    },
  })
  return <div className="pb-condition">
    <div className="pb-condition__comparison" role="group" aria-label={`${label} condition`}>
      <button type="button" className={selectedCondition === 'over' ? 'is-selected' : ''} onClick={() => changeCondition('over')}>{comparisonLabel} &gt;</button>
      <button type="button" className={selectedCondition === 'under' ? 'is-selected' : ''} onClick={() => changeCondition('under')}>{comparisonLabel} &lt;</button>
    </div>
    <Stepper label={label} value={value} unit={unit} step={0.1} max={definition.max} onOpen={openThresholdAdjustment} onChange={(next) => onChange({ exit: next === undefined ? undefined : { type, condition: selectedCondition, value: next } })} />
  </div>
}

function StageDragHandle({ onPointerDown, onPointerMove, onPointerUp }: {
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void
  onPointerMove: (event: ReactPointerEvent<HTMLButtonElement>) => void
  onPointerUp: (event: ReactPointerEvent<HTMLButtonElement>) => void
}) {
  return <button
    type="button"
    className="pb-stage__drag-handle"
    aria-label="Drag to reorder stage"
    onClick={(event) => event.stopPropagation()}
    onPointerDown={(event) => { event.stopPropagation(); onPointerDown(event) }}
    onPointerMove={(event) => { event.stopPropagation(); onPointerMove(event) }}
    onPointerUp={(event) => { event.stopPropagation(); onPointerUp(event) }}
    onPointerCancel={(event) => { event.stopPropagation(); onPointerUp(event) }}
    onLostPointerCapture={(event) => { event.stopPropagation(); onPointerUp(event) }}
  ><img src={builderStageDrag} alt="" /></button>
}

function StageEditorCard({ stage, index, active, isLastStage, onActivate, onChange, onDuplicate, onDelete, canDelete, dragging, issues, panelRequest, onDragStart, onDragMove, onDragEnd, cardRef }: {
  stage: BuilderStage
  index: number
  active: boolean
  isLastStage: boolean
  onActivate: () => void
  onChange: (patch: Partial<BuilderStage>) => void
  onDuplicate: () => void
  onDelete: () => void
  canDelete: boolean
  dragging: boolean
  issues: ProfileBuilderIssue[]
  panelRequest?: { panel: 'target' | 'conditions'; token: number }
  onDragStart: (event: ReactPointerEvent<HTMLButtonElement>) => void
  onDragMove: (event: ReactPointerEvent<HTMLButtonElement>) => void
  onDragEnd: (event: ReactPointerEvent<HTMLButtonElement>) => void
  cardRef: (element: HTMLElement | null) => void
}) {
  const openAdjustment = useValueAdjustment()
  const [activePanel, setActivePanel] = useState<'target' | 'conditions'>(panelRequest?.panel ?? 'target')
  const issueSeverity = issues.some((issue) => issue.severity === 'error') ? 'error' : issues.length ? 'warning' : undefined
  const fieldSeverity = (field: string) => issues.some((issue) => issue.field === field && issue.severity === 'error')
    ? 'error'
    : issues.some((issue) => issue.field === field) ? 'warning' : undefined
  const pumpMemory = useRef(builderPumpMemory(stage))
  const setPump = (pump: BuilderStage['pump']) => {
    const switched = switchBuilderPump(stage, pump, pumpMemory.current)
    pumpMemory.current = switched.memory
    onChange(switched.patch)
  }
  const setTarget = (target: number | undefined) => {
    const value = target ?? 0
    pumpMemory.current[stage.pump] = value
    onChange({ target: value })
  }
  const setLimiter = (value: number | undefined) => {
    const limiterType = stage.pump === 'pressure' ? 'flow' : 'pressure'
    if (value !== undefined) pumpMemory.current[limiterType] = value
    onChange({ limiter: value === undefined ? undefined : { type: limiterType, value, range: stage.limiter?.range ?? 0.4 } })
  }
  const limiterLabel = stage.pump === 'pressure' ? 'Max flow' : 'Max pressure'
  const limiterUnit = stage.pump === 'pressure' ? 'ml/s' : 'bar'
  const limiterValue = stage.limiter?.value
  const targetUnit = stage.pump === 'pressure' ? 'bar' : 'ml/s'
  const openTargetAdjustment = () => {
    const pressure = VALUE_ADJUSTMENTS.builderPressure
    const flow = VALUE_ADJUSTMENTS.builderFlow
    const variants = (['pressure', 'flow'] as const).map((pump) => {
      const definition = pump === 'pressure' ? pressure : flow
      return {
        id: pump,
        label: pump === 'pressure' ? 'Pressure' : 'Flow',
        value: pumpMemory.current[pump] ?? (pump === 'pressure' ? 9 : 2),
        unit: pump === 'pressure' ? 'bar' : 'ml/s',
        ...definition,
        suggestionKey: pump === 'pressure' ? 'builderPressure' as const : 'builderFlow' as const,
      }
    })
    const definition = stage.pump === 'pressure' ? pressure : flow
    openAdjustment({
      label: 'Stage control',
      value: stage.target,
      unit: targetUnit,
      ...definition,
      suggestionKey: stage.pump === 'pressure' ? 'builderPressure' : 'builderFlow',
      selectedVariantId: stage.pump,
      variants,
      onSave: (target, variantId) => {
        const pump = variantId === 'flow' ? 'flow' : 'pressure'
        if (pump === stage.pump) {
          setTarget(target)
          return
        }
        const switched = switchBuilderPump(stage, pump, pumpMemory.current)
        switched.memory[pump] = target
        pumpMemory.current = switched.memory
        onChange({ ...switched.patch, target })
      },
    })
  }
  const openTemperatureAdjustment = () => openAdjustment({
    label: 'Temperature',
    value: stage.temperature,
    unit: '°',
    ...VALUE_ADJUSTMENTS.builderTemperature,
    suggestionKey: 'builderTemperature',
    onSave: (temperature) => onChange({ temperature }),
  })
  const openLimiterAdjustment = () => {
    const definition = stage.pump === 'pressure' ? VALUE_ADJUSTMENTS.builderFlow : VALUE_ADJUSTMENTS.builderPressure
    openAdjustment({
      label: limiterLabel,
      value: limiterValue ?? 0,
      unit: limiterUnit,
      ...definition,
      suggestionKey: stage.pump === 'pressure' ? 'builderFlow' : 'builderPressure',
      onSave: setLimiter,
    })
  }
  const openDurationAdjustment = () => openAdjustment({
    label: 'Max time',
    value: stage.seconds,
    unit: 's',
    ...VALUE_ADJUSTMENTS.builderDuration,
    suggestionKey: 'builderDuration',
    onSave: (seconds) => onChange({ seconds }),
  })
  const openVolumeAdjustment = () => openAdjustment({
    label: 'Move on volume',
    value: stage.volume,
    unit: 'ml',
    ...VALUE_ADJUSTMENTS.builderVolume,
    suggestionKey: 'builderVolume',
    onSave: (volume) => onChange({ volume }),
  })
  const openYieldAdjustment = () => openAdjustment({
    label: 'Move on yield',
    value: stage.weight ?? 0,
    unit: 'g',
    ...VALUE_ADJUSTMENTS.builderYield,
    suggestionKey: 'builderYield',
    onSave: (weight) => onChange({ weight }),
  })
  const stageNumber = index + 1
  const exitSummary = [
    `${formatValue(stage.seconds)}s max`,
    stage.exit?.value
      ? `${stage.exit.type === 'pressure' ? 'Pressure' : 'Flow'} ${stage.exit.condition === 'under' ? '<' : '>'} ${formatValue(stage.exit.value)} ${stage.exit.type === 'pressure' ? 'bar' : 'ml/s'}`
      : null,
    !isLastStage && stage.weight ? `Weight ≥ ${formatValue(stage.weight)} g` : null,
    stage.volume ? `Volume ≥ ${formatValue(stage.volume)} ml` : null,
  ].filter((condition): condition is string => Boolean(condition)).join(' / ')

  if (!active) return <article ref={cardRef} data-stage-id={stage.id} data-validation-severity={issueSeverity} className={`pb-stage is-collapsed${dragging ? ' is-dragging' : ''}`} role="button" tabIndex={0} onClick={onActivate} onKeyDown={(event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    onActivate()
  }} aria-expanded="false" aria-label={`Open stage ${index + 1}: ${stage.name}`}>
    <header className="pb-stage__summary-header">
      <StageDragHandle onPointerDown={onDragStart} onPointerMove={onDragMove} onPointerUp={onDragEnd} />
      <b style={{ backgroundImage: `url(${builderStageNumber})` }}>{stageNumber}</b>
      <span><strong>{stage.name}</strong></span>
      <em>{formatValue(stage.seconds)}<small>s</small></em>
    </header>
    <span className="pb-stage__summary-metrics">
      <span><small>{stage.pump === 'pressure' ? 'Pressure' : 'Flow'} Target</small><strong>{formatValue(stage.target)} <em>{targetUnit}</em></strong>{typeof limiterValue === 'number' && limiterValue > 0 && <i>Max {formatValue(limiterValue)} {limiterUnit}</i>}</span>
      <span><small>{stage.sensor === 'water' ? 'Water' : 'Coffee'} temperature</small><strong>{formatValue(stage.temperature)}°</strong></span>
    </span>
    <span className="pb-stage__summary-exit"><small>Moves on when any is reached</small><strong>{exitSummary}</strong></span>
  </article>

  return <article ref={cardRef} data-stage-id={stage.id} data-validation-severity={issueSeverity} className={`pb-stage is-active is-${activePanel}${dragging ? ' is-dragging' : ''}`} aria-expanded="true" aria-label={`Stage ${index + 1}: ${stage.name}`}>
    <header className="pb-stage__active-header">
      <StageDragHandle onPointerDown={onDragStart} onPointerMove={onDragMove} onPointerUp={onDragEnd} />
      <b style={{ backgroundImage: `url(${builderStageNumber})` }}>{stageNumber}</b>
      <div data-builder-field="name" data-validation-severity={fieldSeverity('name')}><input aria-label={`Stage ${index + 1} name`} value={stage.name} onChange={(event) => onChange({ name: event.target.value })} /></div>
      <div className="pb-stage__tabs" role="tablist" aria-label="Stage settings">
        <button type="button" role="tab" aria-selected={activePanel === 'target'} className={activePanel === 'target' ? 'is-selected' : ''} onClick={() => setActivePanel('target')}>Target</button>
        <button type="button" role="tab" aria-selected={activePanel === 'conditions'} className={activePanel === 'conditions' ? 'is-selected' : ''} onClick={() => setActivePanel('conditions')}>Move on</button>
      </div>
      <div className="pb-stage__actions">
        <button type="button" onClick={onDuplicate} aria-label={`Duplicate stage ${index + 1}`}><img src={builderStageDuplicate} alt="" /></button>
        <button type="button" disabled={!canDelete} onClick={onDelete} aria-label={`Delete stage ${index + 1}`}><img src={builderStageDelete} alt="" /></button>
      </div>
    </header>
    {activePanel === 'target' ? <section className="pb-stage__target-panel" role="tabpanel" aria-label="Target controls">
      <div className="pb-stage__target-main">
        <div className="pb-stage__target-control" data-builder-field="target" data-validation-severity={fieldSeverity('target') ?? fieldSeverity('pump')}>
          <SegmentControl value={stage.pump} onChange={setPump} />
          <Stepper label={`${stage.pump} target`} value={stage.target} unit={targetUnit} step={0.1} max={15.9} onOpen={openTargetAdjustment} onChange={setTarget} />
        </div>
        <div className="pb-stage__temperature-control" data-builder-field="temperature" data-validation-severity={fieldSeverity('temperature')}><small>Temperature</small><Stepper label="Temperature" value={stage.temperature} unit="°" step={0.5} min={0} max={127.5} onOpen={openTemperatureAdjustment} onChange={(temperature) => onChange({ temperature: temperature ?? 0 })} /></div>
        <div className="pb-stage__choice-control" data-builder-field="transition" data-validation-severity={fieldSeverity('transition')}><small>Transition</small><TransitionControl value={stage.transition} onChange={(transition) => onChange({ transition })} /></div>
        <div className="pb-stage__choice-control" data-builder-field="sensor" data-validation-severity={fieldSeverity('sensor')}><small>Measure from</small><SensorControl value={stage.sensor} onChange={(sensor) => onChange({ sensor })} /></div>
      </div>
      <aside className="pb-stage__limits">
        <div data-builder-field="limiter" data-validation-severity={fieldSeverity('limiter')}><small>{limiterLabel}</small><Stepper label={limiterLabel} value={limiterValue} unit={limiterUnit} step={0.1} max={15.9} onOpen={openLimiterAdjustment} onChange={setLimiter} /></div>
        <div data-builder-field="seconds" data-validation-severity={fieldSeverity('seconds')}><small>Max time</small><Stepper label="Duration" value={stage.seconds} unit="s" step={1} min={0} max={127} onOpen={openDurationAdjustment} onChange={(seconds) => onChange({ seconds: seconds ?? 0 })} /></div>
      </aside>
    </section> : <section className="pb-stage__conditions-panel" role="tabpanel" aria-label="Move on conditions">
      <div className="pb-stage__conditions-controls">
        <div className="pb-condition-column" data-builder-field="exit" data-validation-severity={fieldSeverity('exit')}>
          <ExitControl type="flow" stage={stage} onChange={onChange} />
          <ExitControl type="pressure" stage={stage} onChange={onChange} />
        </div>
        <div className="pb-condition-column">
          <div className="pb-condition pb-condition--simple" data-builder-field="volume" data-validation-severity={fieldSeverity('volume')}>
            <small>Move on volume</small>
            <Stepper label="Move on volume" value={stage.volume > 0 ? stage.volume : undefined} unit="ml" step={1} max={1023} onOpen={openVolumeAdjustment} onChange={(volume) => onChange({ volume: volume ?? 0 })} />
          </div>
          <div className={`pb-condition pb-condition--simple${isLastStage ? ' is-disabled' : ''}`} data-builder-field="weight" data-validation-severity={fieldSeverity('weight')}>
            <small>Move on yield</small>
            <Stepper label="Move on yield" value={stage.weight} unit="g" step={0.1} disabled={isLastStage} onOpen={openYieldAdjustment} onChange={(weight) => onChange({ weight })} />
          </div>
        </div>
      </div>
      <p className="pb-stage__conditions-rule"><img src={skipNext} alt="" /><span>The next stage starts as soon as any condition on the left is met.</span></p>
    </section>}
  </article>
}

interface ProfileBuilderScreenProps {
  onClose: () => void
  initialRecord?: DecaidProfileRecord
  existingTitles?: string[]
  onSave?: (profile: DecaidProfile, sourceProfileId: string | undefined, overwriteSource: boolean, metadata?: Record<string, unknown> | null) => Promise<DecaidProfileRecord | null>
  onSaved?: (record: DecaidProfileRecord) => void
}

interface StageDragSession {
  pointerId: number
  stageId: string
  index: number
  startX: number
  startY: number
  lastX: number
  lastY: number
  offsetX: number
  offsetY: number
  moved: boolean
  overlay: HTMLElement
  animationFrame: number | null
  cleanupTimer: number | null
  transitionEndHandler?: (event: TransitionEvent) => void
  ending: boolean
}

export function ProfileBuilderScreen({ onClose, initialRecord, existingTitles = [], onSave, onSaved }: ProfileBuilderScreenProps) {
  const openAdjustment = useValueAdjustment()
  const overwriteSource = initialRecord?.isDefault === false
  const [initialDraft] = useState(() => initialRecord?.profile?.steps?.length
    ? profileDraftFromDecaidProfile(initialRecord.profile, { mode: 'edit', sourceProfileId: initialRecord.id, sourceMetadata: initialRecord.metadata, existingTitles, copyName: !overwriteSource })
    : createDefaultProfileDraft())
  const [draft, setDraft] = useState(initialDraft)
  const [activeStage, setActiveStage] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [profileDetailsOpen, setProfileDetailsOpen] = useState(false)
  const [validationOpen, setValidationOpen] = useState(false)
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false)
  const [stagePanelRequest, setStagePanelRequest] = useState<{ stageId: string; panel: 'target' | 'conditions'; token: number } | null>(null)
  const [draggedStageId, setDraggedStageId] = useState<string | null>(null)
  const stageStripRef = useRef<HTMLElement>(null)
  const stageCards = useRef(new Map<number, HTMLElement>())
  const stageDrag = useRef<StageDragSession | null>(null)
  const pendingStageDrop = useRef<StageDragSession | null>(null)
  const stagePanelRequestSequence = useRef(0)
  const categories = useMemo(() => [undefined, 'Espresso', 'Filter', 'Tea', 'Cleaning'] as const, [])
  const validation = useMemo(() => validateProfileDraft(draft), [draft])
  const volumeFallbackActive = typeof draft.targetVolume === 'number' && draft.targetVolume > 0
  const hasUnsavedChanges = JSON.stringify(draft) !== JSON.stringify(initialDraft)
  const saveDisabled = saving || !validation.canSave || Boolean(initialRecord) && !hasUnsavedChanges
  const profileFieldSeverity = (field: string) => validation.issues.some((issue) => !issue.stageId && issue.field === field && issue.severity === 'error')
    ? 'error'
    : validation.issues.some((issue) => !issue.stageId && issue.field === field) ? 'warning' : undefined

  const removeStageDragArtifacts = (drag: StageDragSession, updateSelection = true) => {
    if (drag.animationFrame !== null) cancelAnimationFrame(drag.animationFrame)
    drag.animationFrame = null
    if (drag.cleanupTimer !== null) window.clearTimeout(drag.cleanupTimer)
    drag.cleanupTimer = null
    if (drag.transitionEndHandler) drag.overlay.removeEventListener('transitionend', drag.transitionEndHandler)
    drag.transitionEndHandler = undefined
    drag.overlay.remove()
    if (stageDrag.current === drag) stageDrag.current = null
    if (pendingStageDrop.current === drag) pendingStageDrop.current = null
    if (!stageDrag.current && !pendingStageDrop.current) document.body.classList.remove('pb-is-stage-dragging')
    if (updateSelection) setDraggedStageId((current) => current === drag.stageId ? null : current)
  }
  const cancelStageDrag = (updateSelection = true) => {
    const active = stageDrag.current
    const pending = pendingStageDrop.current
    if (active) removeStageDragArtifacts(active, updateSelection)
    if (pending && pending !== active) removeStageDragArtifacts(pending, updateSelection)
  }

  useEffect(() => () => {
    cancelStageDrag(false)
    document.body.classList.remove('pb-is-stage-dragging')
  }, [])

  useEffect(() => {
    if (activeStage === null || draggedStageId) return
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
  }, [activeStage, draft.stages.length, draggedStageId])

  const updateDraft = <Key extends keyof ProfileDraft>(key: Key, value: ProfileDraft[Key]) => setDraft((current) => ({
    ...current,
    [key]: value,
    importIssues: current.importIssues?.filter((issue) => issue.stageId || issue.field !== key),
  }))
  const updateStage = (index: number, patch: Partial<BuilderStage>) => setDraft((current) => {
    const stageId = current.stages[index]?.id
    const changedFields = new Set(Object.keys(patch))
    if (changedFields.has('pump')) changedFields.add('target')
    return {
      ...current,
      stages: current.stages.map((stage, stageIndex) => stageIndex === index ? { ...stage, ...patch } : stage),
      importIssues: current.importIssues?.filter((issue) => issue.stageId !== stageId || !changedFields.has(issue.field)),
    }
  })
  const addStage = () => {
    const index = draft.stages.length
    updateDraft('stages', [...draft.stages, nextBuilderStage(index)])
    setActiveStage(index)
  }
  const duplicateStage = (index: number) => {
    setDraft((current) => {
      const stages = [...current.stages]
      stages.splice(index + 1, 0, duplicateBuilderStage(stages[index], index + 1))
      const targetVolumeCountStart = current.targetVolumeCountStart > index
        ? current.targetVolumeCountStart + 1
        : current.targetVolumeCountStart
      return { ...current, stages, targetVolumeCountStart }
    })
    setActiveStage(index + 1)
  }
  const deleteStage = (index: number) => {
    if (draft.stages.length <= 1) return
    setDraft((current) => {
      const removedStage = current.stages[index]
      const stages = current.stages.filter((_, stageIndex) => stageIndex !== index)
      const volumeFallbackActive = typeof current.targetVolume === 'number' && current.targetVolume > 0
      const targetVolumeCountStart = volumeCountStartAfterDelete(current.targetVolumeCountStart, index, stages.length, volumeFallbackActive)
      return {
        ...current,
        stages,
        targetVolumeCountStart,
        importIssues: current.importIssues?.filter((issue) => issue.stageId !== removedStage?.id),
      }
    })
    setActiveStage((current) => {
      if (current === null) return null
      if (current === index) return Math.min(index, draft.stages.length - 2)
      return current > index ? current - 1 : current
    })
  }
  const stageCardElements = () => Array.from(stageStripRef.current?.querySelectorAll<HTMLElement>('.pb-stage[data-stage-id]') ?? [])
  const stageCardById = (stageId: string) => stageCardElements().find((card) => card.dataset.stageId === stageId)
  const stageCardRects = () => new Map(stageCardElements().map((card) => [card.dataset.stageId ?? '', card.getBoundingClientRect()]))
  const animateReorderedStageCards = (before: Map<string, DOMRect>) => {
    requestAnimationFrame(() => {
      stageCardElements().forEach((card) => {
        if (card.dataset.stageId === stageDrag.current?.stageId) return
        const previous = before.get(card.dataset.stageId ?? '')
        if (!previous) return
        const current = card.getBoundingClientRect()
        const deltaX = previous.left - current.left
        if (Math.abs(deltaX) < 1) return
        card.animate([
          { transform: `translate3d(${deltaX}px, 0, 0)` },
          { transform: 'translate3d(0, 0, 0)' },
        ], { duration: 180, easing: 'cubic-bezier(.2,.8,.2,1)' })
      })
    })
  }
  const positionStageDragOverlay = (drag: StageDragSession) => {
    const strip = stageStripRef.current
    const x = drag.lastX - drag.offsetX
    const desiredY = drag.lastY - drag.offsetY
    const overlayHeight = drag.overlay.offsetHeight
    const scaleInset = overlayHeight * 0.0125
    const stripBounds = strip?.getBoundingClientRect()
    const minimumY = stripBounds ? stripBounds.top + scaleInset : desiredY
    const maximumY = stripBounds ? Math.max(minimumY, stripBounds.bottom - overlayHeight - scaleInset) : desiredY
    const y = clamp(desiredY, minimumY, maximumY)
    drag.overlay.style.setProperty('--pb-stage-drag-x', `${x}px`)
    drag.overlay.style.setProperty('--pb-stage-drag-y', `${y}px`)
  }
  const reorderStageAtPointer = (clientX: number) => {
    const drag = stageDrag.current
    const strip = stageStripRef.current
    if (!drag || !strip || !drag.moved) return
    const cards = stageCardElements()
    const otherCards = cards.filter((card) => card.dataset.stageId !== drag.stageId)
    let toIndex = otherCards.length
    for (let index = 0; index < otherCards.length; index += 1) {
      const bounds = otherCards[index].getBoundingClientRect()
      if (clientX < bounds.left + bounds.width / 2) {
        toIndex = index
        break
      }
    }
    toIndex = clamp(toIndex, 0, cards.length - 1)
    if (toIndex === drag.index) return
    const before = stageCardRects()
    const fromIndex = drag.index
    drag.index = toIndex
    const stageNumber = drag.overlay.querySelector<HTMLElement>('.pb-stage__summary-header>b, .pb-stage__active-header>b')
    if (stageNumber) stageNumber.textContent = String(toIndex + 1)
    setDraft((current) => {
      const referencedStage = current.stages[current.targetVolumeCountStart]
      const stages = moveBuilderStage(current.stages, fromIndex, toIndex)
      const remappedReference = referencedStage ? stages.findIndex((stage) => stage.id === referencedStage.id) : current.targetVolumeCountStart
      return { ...current, stages, targetVolumeCountStart: remappedReference }
    })
    setActiveStage((current) => stageIndexAfterMove(current, fromIndex, toIndex))
    animateReorderedStageCards(before)
  }
  const runStageDragFrame = () => {
    const drag = stageDrag.current
    const strip = stageStripRef.current
    if (!drag || !strip) return
    positionStageDragOverlay(drag)
    const bounds = strip.getBoundingClientRect()
    const edgeSize = 72
    let scrollAmount = 0
    if (drag.lastX < bounds.left + edgeSize) scrollAmount = -Math.ceil((bounds.left + edgeSize - drag.lastX) / 5)
    else if (drag.lastX > bounds.right - edgeSize) scrollAmount = Math.ceil((drag.lastX - (bounds.right - edgeSize)) / 5)
    if (scrollAmount !== 0) {
      const previousScrollLeft = strip.scrollLeft
      strip.scrollLeft += clamp(scrollAmount, -18, 18)
      if (strip.scrollLeft !== previousScrollLeft) reorderStageAtPointer(drag.lastX)
    }
    drag.animationFrame = requestAnimationFrame(runStageDragFrame)
  }
  const startStageDrag = (index: number, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    event.preventDefault()
    cancelStageDrag()
    const stageId = draft.stages[index]?.id
    const card = event.currentTarget.closest<HTMLElement>('.pb-stage')
    if (!stageId || !card) return
    event.currentTarget.setPointerCapture(event.pointerId)
    const bounds = card.getBoundingClientRect()
    const overlay = card.cloneNode(true) as HTMLElement
    overlay.classList.remove('is-dragging')
    overlay.classList.add('pb-stage-drag-overlay')
    overlay.removeAttribute('data-stage-id')
    overlay.setAttribute('aria-hidden', 'true')
    overlay.querySelectorAll<HTMLElement>('button,input').forEach((control) => control.setAttribute('tabindex', '-1'))
    const sourceInputs = card.querySelectorAll<HTMLInputElement>('input')
    overlay.querySelectorAll<HTMLInputElement>('input').forEach((input, inputIndex) => { input.value = sourceInputs[inputIndex]?.value ?? input.value })
    overlay.style.width = `${bounds.width}px`
    overlay.style.height = `${bounds.height}px`
    document.body.append(overlay)
    document.body.classList.add('pb-is-stage-dragging')
    stageDrag.current = {
      pointerId: event.pointerId,
      stageId,
      index,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      offsetX: event.clientX - bounds.left,
      offsetY: event.clientY - bounds.top,
      moved: false,
      overlay,
      animationFrame: null,
      cleanupTimer: null,
      ending: false,
    }
    positionStageDragOverlay(stageDrag.current)
    stageDrag.current.animationFrame = requestAnimationFrame(runStageDragFrame)
    setDraggedStageId(stageId)
  }
  const moveStageDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = stageDrag.current
    const strip = stageStripRef.current
    if (!drag || drag.pointerId !== event.pointerId || !strip) return
    event.preventDefault()
    drag.lastX = event.clientX
    drag.lastY = event.clientY
    if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 5) return
    drag.moved = true
    drag.overlay.classList.add('has-moved')
    reorderStageAtPointer(event.clientX)
  }
  const finishStageDrag = (pointerId: number, captureTarget?: HTMLElement) => {
    const drag = stageDrag.current
    if (!drag || drag.pointerId !== pointerId || drag.ending) return
    drag.ending = true
    stageDrag.current = null
    if (captureTarget?.hasPointerCapture(pointerId)) captureTarget.releasePointerCapture(pointerId)
    if (drag.animationFrame !== null) cancelAnimationFrame(drag.animationFrame)
    drag.animationFrame = null
    const destination = stageCardById(drag.stageId)?.getBoundingClientRect()
    const removeOverlay = () => removeStageDragArtifacts(drag)
    if (!destination) {
      removeOverlay()
      return
    }
    pendingStageDrop.current = drag
    drag.overlay.classList.add('is-dropping')
    drag.overlay.style.setProperty('--pb-stage-drag-x', `${destination.left}px`)
    drag.overlay.style.setProperty('--pb-stage-drag-y', `${destination.top}px`)
    drag.transitionEndHandler = (transitionEvent) => {
      if (transitionEvent.target !== drag.overlay || transitionEvent.propertyName !== 'transform') return
      removeOverlay()
    }
    drag.overlay.addEventListener('transitionend', drag.transitionEndHandler)
    drag.cleanupTimer = window.setTimeout(removeOverlay, 280)
  }
  const endStageDrag = (event: ReactPointerEvent<HTMLButtonElement>) => finishStageDrag(event.pointerId, event.currentTarget)

  useEffect(() => {
    const finishPointerDrag = (event: PointerEvent) => finishStageDrag(event.pointerId)
    const cancelInterruptedDrag = () => cancelStageDrag()
    const handleVisibilityChange = () => { if (document.hidden) cancelInterruptedDrag() }
    window.addEventListener('pointerup', finishPointerDrag, true)
    window.addEventListener('pointercancel', finishPointerDrag, true)
    window.addEventListener('blur', cancelInterruptedDrag)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      window.removeEventListener('pointerup', finishPointerDrag, true)
      window.removeEventListener('pointercancel', finishPointerDrag, true)
      window.removeEventListener('blur', cancelInterruptedDrag)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])
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
    label: 'End shot yield',
    value: draft.targetWeight ?? 0,
    unit: 'g',
    ...VALUE_ADJUSTMENTS.targetYield,
    suggestionKey: 'targetYield',
    onSave: (targetWeight) => updateDraft('targetWeight', targetWeight > 0 ? targetWeight : undefined),
  })
  const updateOptionalDraftNumber = (key: 'targetWeight' | 'targetVolume', rawValue: string) => {
    const parsed = rawValue === '' ? undefined : Number(rawValue)
    if (parsed === undefined || Number.isFinite(parsed)) updateDraft(key, parsed)
  }
  const updateRequiredDraftNumber = (key: 'tankTemperature', rawValue: string) => {
    updateDraft(key, rawValue === '' ? Number.NaN : Number(rawValue))
  }
  const updateLimiterRange = (stageIndex: number, rawValue: string) => {
    const limiter = draft.stages[stageIndex]?.limiter
    if (!limiter) return
    const parsed = rawValue === '' ? undefined : Number(rawValue)
    if (parsed === undefined || Number.isFinite(parsed)) updateStage(stageIndex, { limiter: { ...limiter, range: parsed } })
  }
  const saveProfile = async (allowWarnings = false) => {
    if (!onSave || saving || Boolean(initialRecord) && !hasUnsavedChanges) return
    if (!validation.canSave) {
      setValidationOpen(true)
      return
    }
    if (validation.warnings.length && !allowWarnings) {
      setValidationOpen(true)
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      const saved = await onSave(profileDraftToDecaidProfile(draft), draft.sourceProfileId, overwriteSource, draft.sourceMetadata)
      if (saved) {
        if (onSaved) onSaved(saved)
        else onClose()
      }
      else setSaveError('This profile could not be saved.')
    } catch (error) {
      setSaveError(error instanceof Error && error.message ? error.message : 'This profile could not be saved.')
    } finally {
      setSaving(false)
    }
  }
  const requestClose = () => {
    if (saving) return
    if (hasUnsavedChanges) {
      setDiscardConfirmOpen(true)
      return
    }
    onClose()
  }

  useEffect(() => {
    if (!hasUnsavedChanges) return
    const preserveUnsavedDraft = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', preserveUnsavedDraft)
    return () => window.removeEventListener('beforeunload', preserveUnsavedDraft)
  }, [hasUnsavedChanges])

  const reviewIssue = (issue: ProfileBuilderIssue) => {
    setValidationOpen(false)
    setSaveError(null)
    if (!issue.stageId) {
      setActiveStage(null)
      setProfileDetailsOpen(true)
      requestAnimationFrame(() => {
        const selector = issue.field === 'title'
          ? '.pb-topbar__identity input'
          : `[data-builder-field="${issue.field}"] input, [data-builder-field="${issue.field}"] select, [data-builder-field="${issue.field}"] textarea, [data-builder-field="${issue.field}"] button`
        document.querySelector<HTMLElement>(selector)?.focus()
      })
      return
    }
    const stageIndex = draft.stages.findIndex((stage) => stage.id === issue.stageId)
    if (stageIndex < 0) return
    setProfileDetailsOpen(false)
    setActiveStage(stageIndex)
    stagePanelRequestSequence.current += 1
    setStagePanelRequest({ stageId: issue.stageId, panel: issue.panel === 'conditions' ? 'conditions' : 'target', token: stagePanelRequestSequence.current })
    window.setTimeout(() => {
      const card = document.querySelector<HTMLElement>(`.pb-stage[data-stage-id="${issue.stageId}"]`)
      const selectorField = issue.field === 'pump' ? 'target' : issue.field
      const field = card?.querySelector<HTMLElement>(`[data-builder-field="${selectorField}"]`)
      const control = field?.matches('input,button,select,textarea') ? field : field?.querySelector<HTMLElement>('input,button,select,textarea')
      control?.focus()
    }, 480)
  }
  const toggleStage = (index: number) => setActiveStage((current) => current === index ? null : index)
  const dismissActiveStageFromOutside = (event: ReactPointerEvent<HTMLElement>) => {
    if (activeStage === null || draggedStageId) return
    const target = event.target
    if (target instanceof Element && target.closest('.pb-stage')) return
    setActiveStage(null)
  }

  return <main className={`profile-builder-screen pb-screen${activeStage === null ? '' : ' has-active-stage'}${saving ? ' is-saving' : ''}`} aria-busy={saving} onPointerDownCapture={dismissActiveStageFromOutside}>
    <header className="pb-topbar">
      <div className="pb-topbar__identity">
        <input aria-label="Profile name" data-builder-field="title" data-validation-severity={profileFieldSeverity('title')} value={draft.title} onChange={(event) => updateDraft('title', event.target.value)} />
        <div className="pb-topbar__identity-actions">
          <button className="pb-category" type="button" onClick={cycleCategory}>{draft.category ?? 'Category (optional)'}<img src={builderCategoryChevron} alt="" /></button>
          <button
            type="button"
            className={`pb-more-settings${profileDetailsOpen ? ' is-open' : ''}`}
            aria-expanded={profileDetailsOpen}
            aria-controls="profile-builder-details"
            onClick={() => {
              setActiveStage(null)
              setValidationOpen(false)
              setProfileDetailsOpen((current) => !current)
            }}
          ><img src={builderCategoryChevron} alt="" /><span>More settings</span></button>
        </div>
      </div>
      <div className="pb-topbar__metadata">
        <button type="button" className="pb-meta" onClick={cycleType}><span>Type <img src={builderValueChevron} alt="" /></span><strong>{draft.beverageType === 'pourover' ? 'Pour over' : `${draft.beverageType[0].toUpperCase()}${draft.beverageType.slice(1)}`}</strong></button>
        <button type="button" className="pb-meta" onClick={editTargetYield}><span>End shot yield <img src={builderValueChevron} alt="" /></span><strong>{formatValue(draft.targetWeight)} <small>g</small></strong></button>
      </div>
      <div className="pb-topbar__actions">
        <button className="pb-cancel" type="button" onClick={requestClose}>Cancel</button>
        <button className="pb-save" type="button" disabled={saveDisabled} onClick={() => void saveProfile()}>{saving ? 'Saving…' : 'Save'}</button>
        {validation.issues.length > 0 && <button
          className={`pb-validation-indicator${validation.errors.length ? ' has-errors' : ' has-warnings'}`}
          type="button"
          aria-label={`${validation.issues.length} profile ${validation.issues.length === 1 ? 'issue' : 'issues'}`}
          aria-expanded={validationOpen}
          aria-controls="profile-builder-validation"
          onClick={() => {
            setProfileDetailsOpen(false)
            setValidationOpen((current) => !current)
          }}
        ><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 3.2 22 20.6H2L12 3.2Z"/><path d="M12 8.3v6.2M12 17.9v.2"/></svg><span>{validation.issues.length}</span></button>}
      </div>
      {saveError && <p className="pb-save-error" role="alert">{saveError}</p>}
      {validationOpen && validation.issues.length > 0 && <section id="profile-builder-validation" className="pb-validation-panel" aria-label="Profile validation">
        <header>
          <div><h2>{validation.errors.length ? 'Profile needs attention' : 'Review before saving'}</h2><p>{issueSummary(validation)}</p></div>
          <button type="button" onClick={() => setValidationOpen(false)} aria-label="Close validation"><img src={builderCardClose} alt="" /></button>
        </header>
        {validation.issues.length ? <div className="pb-validation-panel__issues">{validation.issues.map((issue) => <button type="button" key={issue.id} className={`is-${issue.severity}`} onClick={() => reviewIssue(issue)}>
          <i aria-hidden="true">{issue.severity === 'error' ? '!' : 'i'}</i>
          <span><strong>{issue.stageIndex === undefined || issue.stageIndex < 0 ? 'Profile' : `Stage ${issue.stageIndex + 1}`}</strong><small>{issue.message}</small></span>
          <em aria-hidden="true">›</em>
        </button>)}</div> : <p className="pb-validation-panel__ready">All required profile data is valid.</p>}
        {!validation.errors.length && validation.warnings.length > 0 && <footer><button type="button" disabled={saveDisabled} onClick={() => void saveProfile(true)}>Save anyway</button></footer>}
      </section>}
      {profileDetailsOpen && <section id="profile-builder-details" className="pb-profile-details" aria-label="Profile details and advanced settings">
        <header>
          <div><h2>More settings</h2><p>Metadata and advanced Decaid profile settings.</p></div>
          <button type="button" onClick={() => setProfileDetailsOpen(false)} aria-label="Close profile details"><img src={builderCardClose} alt="" /></button>
        </header>
        <div className="pb-profile-details__grid">
          <label data-builder-field="beverageType" data-validation-severity={profileFieldSeverity('beverageType')}>
            <span>Beverage type</span>
            <select value={draft.beverageType} onChange={(event) => updateDraft('beverageType', event.target.value as ProfileDraft['beverageType'])}>
              <option value="espresso">Espresso</option>
              <option value="pourover">Pour over</option>
              <option value="manual">Manual</option>
              <option value="cleaning">Cleaning</option>
              <option value="calibrate">Calibrate</option>
            </select>
          </label>
          <label data-builder-field="version" data-validation-severity={profileFieldSeverity('version')}>
            <span>Profile format</span>
            <input value={draft.version ?? ''} placeholder="Optional" onChange={(event) => updateDraft('version', event.target.value || undefined)} />
          </label>
          <label className="pb-profile-details__author" data-builder-field="author" data-validation-severity={profileFieldSeverity('author')}>
            <span>Author</span>
            <input value={draft.author} placeholder="Your Decent username, or user" readOnly aria-describedby="profile-builder-author-help" />
            <small id="profile-builder-author-help">Set from the signed-in account when saved.</small>
          </label>
          <label className="pb-profile-details__notes" data-builder-field="notes" data-validation-severity={profileFieldSeverity('notes')}>
            <span>Notes</span>
            <textarea value={draft.notes} placeholder="Profile description and preparation notes" onChange={(event) => updateDraft('notes', event.target.value)} />
          </label>
          <label data-builder-field="targetWeight" data-validation-severity={profileFieldSeverity('targetWeight')}>
            <span>End shot yield</span>
            <span className="pb-profile-details__number"><input type="number" inputMode="decimal" min="0" step="0.1" value={draft.targetWeight ?? ''} onChange={(event) => updateOptionalDraftNumber('targetWeight', event.target.value)} /><small>g</small></span>
          </label>
          <label data-builder-field="targetVolume" data-validation-severity={profileFieldSeverity('targetVolume')}>
            <span>End shot volume fallback</span>
            <span className="pb-profile-details__number"><input type="number" inputMode="decimal" min="0" step="0.1" value={draft.targetVolume ?? ''} onChange={(event) => updateOptionalDraftNumber('targetVolume', event.target.value)} /><small>ml</small></span>
          </label>
          {volumeFallbackActive && <label data-builder-field="targetVolumeCountStart" data-validation-severity={profileFieldSeverity('targetVolumeCountStart')}>
            <span>Start measuring from</span>
            <select value={draft.targetVolumeCountStart >= 0 && draft.targetVolumeCountStart < draft.stages.length ? draft.targetVolumeCountStart : ''} onChange={(event) => updateDraft('targetVolumeCountStart', Number(event.target.value))}>
              <option value="" disabled>Choose a step</option>
              {draft.stages.map((stage, index) => <option key={stage.id} value={index}>{index + 1}. {stage.name.trim() || `Step ${index + 1}`}</option>)}
            </select>
          </label>}
          <label data-builder-field="tankTemperature" data-validation-severity={profileFieldSeverity('tankTemperature')}>
            <span>Tank temperature</span>
            <span className="pb-profile-details__number"><input type="number" inputMode="decimal" min="0" step="0.5" value={Number.isFinite(draft.tankTemperature) ? draft.tankTemperature : ''} onChange={(event) => updateRequiredDraftNumber('tankTemperature', event.target.value)} /><small>°C</small></span>
          </label>
        </div>
        <div className="pb-profile-details__limiters">
          <h3>Stage limiter response range</h3>
          {draft.stages.some((stage) => Boolean(stage.limiter))
            ? <div>{draft.stages.map((stage, index) => stage.limiter && <label key={stage.id} data-builder-field="limiter"><span>{index + 1}. {stage.name}</span><span className="pb-profile-details__number"><input type="number" inputMode="decimal" min="0" max="15.9" step="0.1" value={stage.limiter.range ?? ''} placeholder="Required" onChange={(event) => updateLimiterRange(index, event.target.value)} /><small>{stage.limiter.type === 'pressure' ? 'bar' : 'ml/s'}</small></span></label>)}</div>
            : <p>No stage currently uses an opposite-axis limiter.</p>}
        </div>
      </section>}
    </header>
    <BuilderChart draft={draft} activeStage={activeStage} />
    <section ref={stageStripRef} className="pb-stage-strip" aria-label="Editable brew stages">
      {draft.stages.map((stage, index) => <StageEditorCard
        key={`${stage.id}-${stagePanelRequest?.stageId === stage.id ? stagePanelRequest.token : 0}`}
        cardRef={(element) => { if (element) stageCards.current.set(index, element); else stageCards.current.delete(index) }}
        stage={stage}
        index={index}
        active={index === activeStage}
        isLastStage={index === draft.stages.length - 1}
        dragging={stage.id === draggedStageId}
        issues={validation.issues.filter((issue) => issue.stageId === stage.id)}
        panelRequest={stagePanelRequest?.stageId === stage.id ? stagePanelRequest : undefined}
        canDelete={draft.stages.length > 1}
        onActivate={() => toggleStage(index)}
        onChange={(patch) => updateStage(index, patch)}
        onDuplicate={() => duplicateStage(index)}
        onDelete={() => deleteStage(index)}
        onDragStart={(event) => startStageDrag(index, event)}
        onDragMove={moveStageDrag}
        onDragEnd={endStageDrag}
      />)}
      <button className="pb-add-stage" type="button" aria-label="Add stage" onClick={addStage}>
        <span><img src={builderStepPlus} alt="" /></span>
        <strong>Add stage</strong>
      </button>
    </section>
    {discardConfirmOpen && <div className="pb-discard-overlay" role="presentation" onPointerDown={(event) => { if (event.target === event.currentTarget) setDiscardConfirmOpen(false) }}>
      <section className="pb-discard-dialog" role="alertdialog" aria-modal="true" aria-labelledby="pb-discard-title" aria-describedby="pb-discard-copy">
        <h2 id="pb-discard-title">Discard profile changes?</h2>
        <p id="pb-discard-copy">Your unsaved changes will be lost.</p>
        <div>
          <button type="button" onClick={() => setDiscardConfirmOpen(false)}>Keep editing</button>
          <button className="pb-discard-dialog__discard" type="button" onClick={onClose}>Discard</button>
        </div>
      </section>
    </div>}
  </main>
}
