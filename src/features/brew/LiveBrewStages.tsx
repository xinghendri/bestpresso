import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import type { LiveShotPoint } from '../../domain/brewing'

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

export function LiveBrewStages({ points, elapsedMs, active = false, selectedStageKey, onStageSelect }: { points: LiveShotPoint[]; elapsedMs: number; active?: boolean; selectedStageKey?: string; onStageSelect?: (stage: BrewStageSelection | null) => void }) {
  const stages = summarizeLiveBrewStages(points, elapsedMs)
  const stripRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!active || !stripRef.current) return
    const animationFrame = window.requestAnimationFrame(() => {
      const strip = stripRef.current
      if (strip) strip.scrollTo({ left: strip.scrollWidth - strip.clientWidth, behavior: 'smooth' })
    })
    return () => window.cancelAnimationFrame(animationFrame)
  }, [active, stages.length])

  if (!stages.length) return <section className="live-brew-stages live-brew-stages--empty" aria-label="Pull stages"><p>Waiting for the first stage…</p></section>

  return <section className={`live-brew-stages${active ? ' live-brew-stages--active' : ''}`} aria-label="Pull stages" ref={stripRef}>
    <div className="live-brew-stages__track">
    {stages.map((stage, index) => {
      const isActive = active && index === stages.length - 1
      const isSelected = selectedStageKey === stage.key
      const selectable = Boolean(onStageSelect)
      const pressureWidth = Math.min(760, 460 + Math.max(0, stage.pressureMovements.length - 2) * 58)
      const cardStyle = { '--stage-card-width': `${pressureWidth}px` } as CSSProperties
      const toggleSelection = () => onStageSelect?.(isSelected ? null : { key: stage.key, name: stage.name, startedAt: stage.startedAt, endedAt: stage.endedAt, points: stage.points })
      return <article className={`live-brew-stage${isActive ? ' live-brew-stage--active' : ''}${isSelected ? ' live-brew-stage--selected' : ''}`} aria-current={isActive ? 'step' : undefined} aria-pressed={selectable ? isSelected : undefined} key={stage.key} onClick={selectable ? toggleSelection : undefined} onKeyDown={selectable ? (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        toggleSelection()
      } : undefined} role={selectable ? 'button' : undefined} style={cardStyle} tabIndex={selectable ? 0 : undefined}>
      <header><h2>{stage.name}</h2><time>{timedLabel(stage.endedAt - stage.startedAt)}</time></header>
      <dl>
        <div><dt>Yield</dt><dd>{reading(stage.yield)}<small>g</small></dd></div>
        <div><dt>Temperature range</dt><dd>{reading(stage.minimumTemperature, 0)}° – {reading(stage.maximumTemperature, 0)}°</dd></div>
        <div><dt>Pressure</dt><dd>{stage.pressureMovements.length ? stage.pressureMovements.map((pressure) => reading(pressure)).join(' → ') : '—'}</dd></div>
      </dl>
    </article>})}
    </div>
  </section>
}
