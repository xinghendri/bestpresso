import { useEffect, useRef, useState } from 'react'
import type { MouseEvent, PointerEvent } from 'react'
import skipNext from '../../assets/figma/skip-next.svg'
import type { LiveShotPoint } from '../../domain/brewing'
import { DOUBLE_TAP_CONFIRMATION_WINDOW_MS, registerDoubleTap } from './doubleTapConfirmation'
import { latestStageScrollLeft } from './stageStripScroll'

interface StageSummary {
  key: string
  name: string
  startedAt: number
  endedAt: number
  yield: number | undefined
  minimumTemperature: number | undefined
  maximumTemperature: number | undefined
  pressureMovements: number[]
  points: LiveShotPoint[]
}

export interface BrewStageSelection {
  key: string
  name: string
  startedAt: number
  endedAt: number
  points: LiveShotPoint[]
}

const PRESSURE_REVERSAL_THRESHOLD_BAR = 0.4

const timedLabel = (milliseconds: number) => {
  const seconds = Math.max(0, Math.round(milliseconds / 1000))
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

const finiteValues = (points: LiveShotPoint[], key: 'temperature' | 'pressure' | 'weight') => points
  .map((point) => point[key])
  .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))

function pressureMovementReadings(pressures: number[]) {
  if (pressures.length < 2) return pressures

  const movements = [pressures[0]]
  let direction = 0
  let extreme = pressures[0]

  for (const pressure of pressures.slice(1)) {
    const fromExtreme = pressure - extreme
    if (direction === 0) {
      const fromStart = pressure - movements[0]
      if (Math.abs(fromStart) >= PRESSURE_REVERSAL_THRESHOLD_BAR) direction = Math.sign(fromStart)
      extreme = pressure
      continue
    }

    if (fromExtreme * direction >= 0) {
      extreme = pressure
      continue
    }

    if (Math.abs(fromExtreme) >= PRESSURE_REVERSAL_THRESHOLD_BAR) {
      movements.push(extreme)
      direction = Math.sign(fromExtreme)
      extreme = pressure
    }
  }

  const finalPressure = pressures.at(-1)!
  if (Math.abs(finalPressure - movements.at(-1)!) >= 0.05) movements.push(finalPressure)
  return movements
}

function summarizeLiveBrewStages(points: LiveShotPoint[], elapsedMs: number): StageSummary[] {
  const groups: Array<{ key: string; name: string; points: LiveShotPoint[] }> = []
  for (const point of points) {
    const name = point.stageName?.trim() || 'Extraction'
    const key = point.stageIndex === undefined ? `name:${name}` : `frame:${point.stageIndex}`
    const current = groups.at(-1)
    if (!current || current.key !== key) groups.push({ key, name, points: [point] })
    else current.points.push(point)
  }

  return groups.map((group, index) => {
    const temperatures = finiteValues(group.points, 'temperature')
    const pressures = finiteValues(group.points, 'pressure')
    const weights = finiteValues(group.points, 'weight')
    const startedAt = group.points[0]?.elapsedMs ?? 0
    const endedAt = groups[index + 1]?.points[0]?.elapsedMs ?? Math.max(elapsedMs, group.points.at(-1)?.elapsedMs ?? startedAt)
    return {
      key: `${group.key}:${index}`,
      name: group.name,
      startedAt,
      endedAt,
      yield: weights.at(-1),
      minimumTemperature: temperatures.length ? Math.min(...temperatures) : undefined,
      maximumTemperature: temperatures.length ? Math.max(...temperatures) : undefined,
      pressureMovements: pressureMovementReadings(pressures),
      points: group.points,
    }
  })
}

const reading = (value: number | undefined, digits = 1) => value === undefined ? '—' : value.toFixed(digits)

export function LiveBrewStages({ points, elapsedMs, active = false, showYield = true, skipPending = false, selectedStageKey, onStageSelect, onSkipStage }: { points: LiveShotPoint[]; elapsedMs: number; active?: boolean; showYield?: boolean; skipPending?: boolean; selectedStageKey?: string; onStageSelect?: (stage: BrewStageSelection | null) => void; onSkipStage?: () => Promise<boolean> }) {
  const stages = summarizeLiveBrewStages(points, elapsedMs)
  const stripRef = useRef<HTMLElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const stageRefs = useRef(new Map<string, HTMLElement>())
  const previousSkipTap = useRef<number | null>(null)
  const skipConfirmationTimeout = useRef<number | null>(null)
  const skipButtonRef = useRef<HTMLButtonElement>(null)
  const [skippedStageKeys, setSkippedStageKeys] = useState<Set<string>>(() => new Set())

  const resetSkipConfirmation = () => {
    previousSkipTap.current = null
    skipButtonRef.current?.classList.remove('live-brew-skip--armed')
    skipButtonRef.current?.setAttribute('aria-pressed', 'false')
    if (skipConfirmationTimeout.current !== null) window.clearTimeout(skipConfirmationTimeout.current)
    skipConfirmationTimeout.current = null
  }

  useEffect(() => () => {
    if (skipConfirmationTimeout.current !== null) window.clearTimeout(skipConfirmationTimeout.current)
  }, [])

  useEffect(() => {
    if (!active) resetSkipConfirmation()
  }, [active])

  const handleSkipTap = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    if (skipPending || !onSkipStage) return
    const result = registerDoubleTap(previousSkipTap.current, Date.now())
    previousSkipTap.current = result.nextTapAt
    if (result.confirmed) {
      const skippedStageKey = stages.at(-1)?.key
      resetSkipConfirmation()
      if (await onSkipStage() && skippedStageKey) {
        setSkippedStageKeys((current) => new Set(current).add(skippedStageKey))
      }
      return
    }
    skipButtonRef.current?.classList.add('live-brew-skip--armed')
    skipButtonRef.current?.setAttribute('aria-pressed', 'true')
    if (skipConfirmationTimeout.current !== null) window.clearTimeout(skipConfirmationTimeout.current)
    skipConfirmationTimeout.current = window.setTimeout(resetSkipConfirmation, DOUBLE_TAP_CONFIRMATION_WINDOW_MS)
  }

  const consumeSkipPointer = (event: PointerEvent<HTMLButtonElement>) => {
    event.stopPropagation()
  }

  const consumeSkipDoubleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
  }

  useEffect(() => {
    const strip = stripRef.current
    const track = trackRef.current
    if (!active || !strip || !track) return
    let animationFrame = 0
    const revealLatestStage = () => {
      window.cancelAnimationFrame(animationFrame)
      animationFrame = window.requestAnimationFrame(() => {
        const left = latestStageScrollLeft(stages.length, strip.scrollWidth, strip.clientWidth)
        strip.scrollTo({ left, behavior: stages.length > 1 ? 'smooth' : 'auto' })
      })
    }
    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(revealLatestStage)
    resizeObserver?.observe(track)
    revealLatestStage()
    return () => {
      resizeObserver?.disconnect()
      window.cancelAnimationFrame(animationFrame)
    }
  }, [active, stages.length])

  useEffect(() => {
    if (active || !selectedStageKey || !stripRef.current) return
    const strip = stripRef.current
    let scrollFrame = 0
    const centerSelectedStage = () => {
      window.cancelAnimationFrame(scrollFrame)
      scrollFrame = window.requestAnimationFrame(() => {
        const selectedStage = stageRefs.current.get(selectedStageKey)
        if (!selectedStage) return
        const stripBounds = strip.getBoundingClientRect()
        const stageBounds = selectedStage.getBoundingClientRect()
        const stageLeftInStrip = stageBounds.left - stripBounds.left + strip.scrollLeft
        const centeredLeft = stageLeftInStrip + stageBounds.width / 2 - strip.clientWidth / 2
        strip.scrollTo({ left: centeredLeft, behavior: 'smooth' })
      })
    }
    const animationFrame = window.requestAnimationFrame(centerSelectedStage)
    window.addEventListener('resize', centerSelectedStage)
    return () => {
      window.cancelAnimationFrame(animationFrame)
      window.cancelAnimationFrame(scrollFrame)
      window.removeEventListener('resize', centerSelectedStage)
    }
  }, [active, selectedStageKey, stages.length])

  if (!stages.length) return <section className="live-brew-stages live-brew-stages--empty" aria-label="Pull stages"><p>Waiting for the first stage…</p></section>

  return <section className={`live-brew-stages${active ? ' live-brew-stages--active' : ''}${showYield ? '' : ' live-brew-stages--no-yield'}`} aria-label="Pull stages" ref={stripRef}>
    <div className="live-brew-stages__track" ref={trackRef}>
    {stages.map((stage, index) => {
      const isActive = active && index === stages.length - 1
      const isSelected = selectedStageKey === stage.key
      const wasSkipped = skippedStageKeys.has(stage.key)
      const selectable = Boolean(onStageSelect)
      const toggleSelection = () => onStageSelect?.(isSelected ? null : { key: stage.key, name: stage.name, startedAt: stage.startedAt, endedAt: stage.endedAt, points: stage.points })
      return <article className={`live-brew-stage${isActive ? ' live-brew-stage--active' : ''}${isSelected ? ' live-brew-stage--selected' : ''}`} aria-current={isActive ? 'step' : undefined} aria-pressed={selectable ? isSelected : undefined} key={stage.key} onClick={selectable ? toggleSelection : undefined} onKeyDown={selectable ? (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        toggleSelection()
      } : undefined} ref={(node) => {
        if (node) stageRefs.current.set(stage.key, node)
        else stageRefs.current.delete(stage.key)
      }} role={selectable ? 'button' : undefined} tabIndex={selectable ? 0 : undefined}>
      <header><h2>{stage.name}</h2><div className="live-brew-stage__time"><time>{timedLabel(stage.endedAt - stage.startedAt)}</time>{wasSkipped && <span className="live-brew-stage__skipped" aria-label="Skipped phase"><img src={skipNext} alt="" /></span>}</div></header>
      <dl>
        {showYield && <div><dt>Yield</dt><dd>{reading(stage.yield)}<small>g</small></dd></div>}
        <div><dt>Temperature range</dt><dd>{reading(stage.minimumTemperature, 0)}° – {reading(stage.maximumTemperature, 0)}°</dd></div>
        <div><dt>Pressure</dt><dd>{stage.pressureMovements.length ? stage.pressureMovements.map((pressure) => reading(pressure)).join(' → ') : '—'}</dd></div>
      </dl>
    </article>})}
    {active && onSkipStage && <button className={`live-brew-skip${skipPending ? ' live-brew-skip--pending' : ''}`} type="button" disabled={skipPending} aria-label="Double tap to skip to the next phase" aria-pressed="false" onPointerDown={consumeSkipPointer} onPointerUp={consumeSkipPointer} onPointerCancel={consumeSkipPointer} onClick={handleSkipTap} onDoubleClick={consumeSkipDoubleClick} ref={skipButtonRef}>
      <img className="live-brew-skip__icon" src={skipNext} alt="" />
      <span>double tap to skip</span>
    </button>}
    </div>
  </section>
}
