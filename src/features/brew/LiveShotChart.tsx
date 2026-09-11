import { useEffect, useId, useRef, useState } from 'react'
import type { LiveShotPoint } from '../../domain/brewing'
import { formatTemperatureValue, temperatureUnitLabel } from '../../domain/temperature'
import { useBestpressoPreferences } from '../settings/bestpressoPreferences'
import { ChartLegend } from './ChartLegend'
import { ChartStageMarkers } from './ChartStageMarkers'
import type { ChartStageMarker } from './ChartStageMarkers'
import type { ChartSeries } from './chartSeries'
import { chartSeriesForLine } from './chartSeries'
import type { ChartFocusTransform } from './chartFocus'
import { chartFocusLayerOpacity, focusedChartTransform, interpolateChartFocusTransform } from './chartFocus'
import { horizontalChartGridLines } from './chartGrid'
import { inspectShotTelemetry } from './chartInspection'
import { smoothShotTelemetry } from './chartSmoothing'
import { removeOverlappingFocusedTimeTicks, shouldShowTimelineLabel } from './chartTimeTicks'

interface LiveShotChartProps {
  points: LiveShotPoint[]
  elapsedMs: number
  targetYield: number
  startMs?: number
  fitDuration?: boolean
  contextPoints?: LiveShotPoint[]
  showWeight?: boolean
  legendFilterEnabled?: boolean
  dimmedSeries?: ChartSeries[]
  onToggleSeries?: (series: ChartSeries) => void
}

const VIEW_WIDTH = 1000
const VIEW_HEIGHT = 376
const PLOT = { left: 42, right: 978, top: 64, bottom: 340 }
const PLOT_TOP_STROKE_ALLOWANCE = 4
const PLOT_BOTTOM_STROKE_ALLOWANCE = 4
const NORMAL_CHART_TRANSFORM: ChartFocusTransform = { scaleX: 1, translateX: 0 }
const CHART_FOCUS_TRANSITION_MS = 460
const INSPECTION_HOLD_MS = 180
const INSPECTION_MOVE_TOLERANCE_PX = 12

const stageMarkersForPoints = (points: LiveShotPoint[], elapsedMs: number): ChartStageMarker[] => {
  const stages: ChartStageMarker[] = []
  for (const point of points) {
    const name = point.stageName?.trim() || 'Extraction'
    const identity = point.stageIndex === undefined ? `name:${name}` : `frame:${point.stageIndex}`
    const current = stages[stages.length - 1]
    if (current?.key.startsWith(`${identity}:`)) continue
    if (current) current.endMs = point.elapsedMs
    stages.push({ key: `${identity}:${stages.length}`, name, startMs: point.elapsedMs, endMs: elapsedMs })
  }
  return stages
}

const linePath = (points: LiveShotPoint[], key: keyof LiveShotPoint, xForElapsedMs: (elapsedMs: number) => number, minimum: number, maximum: number) => {
  let path = ''
  let drawing = false
  for (const point of points) {
    const value = point[key]
    if (typeof value !== 'number') {
      drawing = false
      continue
    }
    const x = xForElapsedMs(point.elapsedMs)
    const ratio = Math.max(0, Math.min(1, (value - minimum) / (maximum - minimum)))
    const y = PLOT.bottom - ratio * (PLOT.bottom - PLOT.top)
    path += `${drawing ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`
    drawing = true
  }
  return path
}

const areaPath = (points: LiveShotPoint[], key: keyof LiveShotPoint, xForElapsedMs: (elapsedMs: number) => number, minimum: number, maximum: number) => {
  const segments: string[] = []
  let segment: Array<{ x: number; y: number }> = []
  const closeSegment = () => {
    if (segment.length === 0) return
    const first = segment[0]
    const last = segment[segment.length - 1]
    segments.push(`M${first.x.toFixed(1)},${PLOT.bottom}L${segment.map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`).join('L')}L${last.x.toFixed(1)},${PLOT.bottom}Z`)
    segment = []
  }
  for (const point of points) {
    const value = point[key]
    if (typeof value !== 'number') {
      closeSegment()
      continue
    }
    const ratio = Math.max(0, Math.min(1, (value - minimum) / (maximum - minimum)))
    segment.push({
      x: xForElapsedMs(point.elapsedMs),
      y: PLOT.bottom - ratio * (PLOT.bottom - PLOT.top),
    })
  }
  closeSegment()
  return segments.join('')
}

const yForValue = (value: number | undefined, minimum: number, maximum: number) => {
  if (typeof value !== 'number') return null
  const ratio = Math.max(0, Math.min(1, (value - minimum) / (maximum - minimum)))
  return PLOT.bottom - ratio * (PLOT.bottom - PLOT.top)
}

const inspectionTimeLabel = (elapsedMs: number) => {
  const totalSeconds = Math.max(0, elapsedMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds - minutes * 60
  return `${String(minutes).padStart(2, '0')}:${seconds.toFixed(1).padStart(4, '0')}`
}

const reading = (value: number | undefined, digits: number) => typeof value === 'number' ? value.toFixed(digits) : '—'

const useAnimatedChartFocus = (target: ChartFocusTransform) => {
  const currentRef = useRef(target)
  const [current, setCurrent] = useState(target)
  const targetScaleX = target.scaleX
  const targetTranslateX = target.translateX

  useEffect(() => {
    const nextTarget = { scaleX: targetScaleX, translateX: targetTranslateX }
    const from = currentRef.current
    if (from.scaleX === nextTarget.scaleX && from.translateX === nextTarget.translateX) return

    const startedAt = performance.now()
    let frame = 0
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const animate = (now: number) => {
      const linearProgress = reduceMotion ? 1 : Math.min(1, (now - startedAt) / CHART_FOCUS_TRANSITION_MS)
      const easedProgress = 1 - Math.pow(1 - linearProgress, 3)
      const next = interpolateChartFocusTransform(from, nextTarget, easedProgress)
      currentRef.current = next
      setCurrent(next)
      if (linearProgress < 1) frame = window.requestAnimationFrame(animate)
    }
    frame = window.requestAnimationFrame(animate)
    return () => window.cancelAnimationFrame(frame)
  }, [targetScaleX, targetTranslateX])

  return current
}

export function LiveShotChart({ points, elapsedMs, targetYield, startMs = 0, fitDuration = false, contextPoints, showWeight = true, legendFilterEnabled = false, dimmedSeries = [], onToggleSeries }: LiveShotChartProps) {
  const { preferences } = useBestpressoPreferences()
  const gradientId = useId().replaceAll(':', '')
  const svgRef = useRef<SVGSVGElement>(null)
  const inspectionGesture = useRef<{ pointerId: number; startX: number; startY: number; timer: number; active: boolean } | null>(null)
  const activePointers = useRef(new Set<number>())
  const [inspectionElapsedMs, setInspectionElapsedMs] = useState<number | null>(null)
  const [retainedFocusPoints, setRetainedFocusPoints] = useState<LiveShotPoint[]>([])
  useEffect(() => {
    if (!contextPoints) return
    const frame = window.requestAnimationFrame(() => setRetainedFocusPoints(points))
    return () => window.cancelAnimationFrame(frame)
  }, [contextPoints, points])
  const durationMs = fitDuration ? Math.max(elapsedMs, 1) : Math.max(10_000, Math.ceil(Math.max(elapsedMs, 1) / 5_000) * 5_000)
  const plottedPoints = contextPoints ?? points
  const focusPoints = contextPoints ? points : retainedFocusPoints
  const displayPlottedPoints = smoothShotTelemetry(plottedPoints)
  const smoothedByElapsedMs = new Map(displayPlottedPoints.map((point) => [point.elapsedMs, point]))
  const displayFocusPoints = focusPoints.map((point) => smoothedByElapsedMs.get(point.elapsedMs) ?? point)
  const observedWeight = Math.max(0, ...plottedPoints.map((point) => point.weight ?? 0))
  const weightMax = Math.max(50, targetYield * 1.2, observedWeight * 1.12)
  const plotWidth = PLOT.right - PLOT.left
  const focusEndMs = startMs + durationMs
  const contextStartMs = plottedPoints[0]?.elapsedMs ?? startMs
  const contextEndMs = plottedPoints.at(-1)?.elapsedMs ?? focusEndMs
  const domainStartMs = contextPoints ? Math.min(contextStartMs, startMs) : startMs
  const domainEndMs = contextPoints ? Math.max(contextEndMs, focusEndMs) : focusEndMs
  const domainDurationMs = Math.max(1, domainEndMs - domainStartMs)
  const baseXForElapsedMs = (pointElapsedMs: number) => {
    const ratio = Math.max(0, Math.min(1, (pointElapsedMs - domainStartMs) / domainDurationMs))
    return PLOT.left + ratio * plotWidth
  }
  const targetFocusTransform = contextPoints ? focusedChartTransform({
    contextStartMs: domainStartMs,
    contextEndMs: domainEndMs,
    focusStartMs: startMs,
    focusEndMs,
    plotLeft: PLOT.left,
    plotWidth,
  }) : NORMAL_CHART_TRANSFORM
  const animatedFocusTransform = useAnimatedChartFocus(targetFocusTransform)
  const layerOpacity = chartFocusLayerOpacity(animatedFocusTransform.scaleX)
  const xForElapsedMs = (pointElapsedMs: number) => animatedFocusTransform.translateX + baseXForElapsedMs(pointElapsedMs) * animatedFocusTransform.scaleX
  const stageMarkers = stageMarkersForPoints(plottedPoints, domainEndMs)
  const highlightedStage = contextPoints
    ? stageMarkers.find((stage) => startMs >= stage.startMs && startMs < stage.endMs)
    : fitDuration ? undefined : stageMarkers[stageMarkers.length - 1]
  const intervalTicks = Array.from({ length: Math.floor(durationMs / 5_000) }, (_, index) => (index + 1) * 5_000)
  const candidateTimeTicks = fitDuration
    ? [0, ...intervalTicks, ...(durationMs % 5_000 ? [durationMs] : [])]
    : intervalTicks
  const horizontalGridLines = horizontalChartGridLines(PLOT)
  const timeLabel = (tick: number) => {
    const seconds = (startMs + tick) / 1000
    return `${Number.isInteger(seconds) ? seconds : seconds.toFixed(1)}s`
  }
  const gridTimeTicks = candidateTimeTicks.map((offsetMs) => ({
    offsetMs,
    x: xForElapsedMs(startMs + offsetMs),
  }))
  const labelTimeTicks = gridTimeTicks.filter(({ offsetMs }) => shouldShowTimelineLabel(
    offsetMs,
    startMs,
    durationMs,
    fitDuration && (offsetMs === 0 || offsetMs === durationMs),
  )).map((tick) => ({ ...tick, label: timeLabel(tick.offsetMs) }))
  const timeLabels = fitDuration
    ? removeOverlappingFocusedTimeTicks(labelTimeTicks.map(({ offsetMs, x, label }) => ({
      offsetMs,
      x,
      label,
    })))
    : labelTimeTicks
  const lineClass = (series: ChartSeries) => dimmedSeries.includes(series) ? ' chart-line--dimmed' : ''

  const elapsedMsForClientX = (clientX: number) => {
    const bounds = svgRef.current?.getBoundingClientRect()
    if (!bounds?.width) return null
    const viewX = (clientX - bounds.left) / bounds.width * VIEW_WIDTH
    const baseX = (viewX - animatedFocusTransform.translateX) / animatedFocusTransform.scaleX
    const ratio = Math.max(0, Math.min(1, (baseX - PLOT.left) / plotWidth))
    return domainStartMs + ratio * domainDurationMs
  }
  const updateInspection = (clientX: number) => {
    const inspectedElapsedMs = elapsedMsForClientX(clientX)
    if (inspectedElapsedMs !== null) setInspectionElapsedMs(inspectedElapsedMs)
  }
  const cancelInspectionGesture = () => {
    const gesture = inspectionGesture.current
    if (gesture) window.clearTimeout(gesture.timer)
    inspectionGesture.current = null
    setInspectionElapsedMs(null)
  }
  const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    activePointers.current.add(event.pointerId)
    if (activePointers.current.size !== 1 || event.button !== 0) {
      cancelInspectionGesture()
      return
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    const gesture = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      timer: 0,
      active: false,
    }
    gesture.timer = window.setTimeout(() => {
      if (inspectionGesture.current !== gesture || activePointers.current.size !== 1) return
      gesture.active = true
      updateInspection(event.clientX)
    }, INSPECTION_HOLD_MS)
    inspectionGesture.current = gesture
  }
  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const gesture = inspectionGesture.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    if (!gesture.active && Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) > INSPECTION_MOVE_TOLERANCE_PX) {
      cancelInspectionGesture()
      return
    }
    if (gesture.active) updateInspection(event.clientX)
  }
  const handlePointerEnd = (event: React.PointerEvent<SVGSVGElement>) => {
    activePointers.current.delete(event.pointerId)
    if (inspectionGesture.current?.pointerId === event.pointerId) cancelInspectionGesture()
  }
  useEffect(() => () => {
    if (inspectionGesture.current) window.clearTimeout(inspectionGesture.current.timer)
  }, [])

  const smoothedInspection = inspectionElapsedMs === null ? null : inspectShotTelemetry(displayPlottedPoints, inspectionElapsedMs)
  const rawInspection = inspectionElapsedMs === null ? null : inspectShotTelemetry(plottedPoints, inspectionElapsedMs)
  const inspection = smoothedInspection && rawInspection ? { ...smoothedInspection, weight: rawInspection.weight } : smoothedInspection ?? rawInspection
  const inspectionX = inspection ? xForElapsedMs(inspection.elapsedMs) : null
  const inspectionPressureY = yForValue(inspection?.pressure, 0, 12)
  const inspectionFlowY = yForValue(inspection?.flow, 0, 12)
  const inspectionTemperatureY = yForValue(inspection?.temperature, 70, 100)
  const inspectionWeightY = yForValue(inspection?.weight, 0, weightMax)

  return <div className="live-shot-chart">
    <ChartLegend showWeight={showWeight} interactive={legendFilterEnabled} dimmedSeries={dimmedSeries} onToggleSeries={onToggleSeries} />
    <ChartStageMarkers stages={stageMarkers} highlightedKey={highlightedStage?.key} xForElapsedMs={xForElapsedMs} plotLeft={PLOT.left} plotRight={PLOT.right} />
    <div className="live-shot-chart__plot">
    <svg ref={svgRef} viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`} role="img" aria-label={showWeight ? 'Pressure, flow, yield weight, and temperature chart. Touch and hold to inspect.' : 'Pressure, flow, and temperature chart. Touch and hold to inspect.'} preserveAspectRatio="none" onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerEnd} onPointerCancel={handlePointerEnd} onContextMenu={(event) => event.preventDefault()}>
      <defs>
        <clipPath id={`${gradientId}-plot`}><rect x={PLOT.left} y={PLOT.top - PLOT_TOP_STROKE_ALLOWANCE} width={PLOT.right - PLOT.left} height={PLOT.bottom - PLOT.top + PLOT_TOP_STROKE_ALLOWANCE + PLOT_BOTTOM_STROKE_ALLOWANCE} /></clipPath>
        <linearGradient id={`${gradientId}-pressure-area`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--chart-pressure)" stopOpacity=".15" /><stop offset="1" stopColor="var(--chart-pressure)" stopOpacity="0" /></linearGradient>
        <linearGradient id={`${gradientId}-flow-area`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--chart-flow)" stopOpacity=".15" /><stop offset="1" stopColor="var(--chart-flow)" stopOpacity="0" /></linearGradient>
        <linearGradient id={`${gradientId}-temperature-area`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--chart-temperature)" stopOpacity=".09" /><stop offset="1" stopColor="var(--chart-temperature)" stopOpacity="0" /></linearGradient>
      </defs>
      {horizontalGridLines.map((line) => <line key={`horizontal-${line.ratio}`} className="chart-grid chart-grid--horizontal" x1={line.x1} x2={line.x2} y1={line.y} y2={line.y} />)}
      {timeLabels.map((tick) => <text key={`time-label-${tick.offsetMs}`} className="chart-axis-label" x={tick.x} y={PLOT.bottom + 25} textAnchor="middle">{tick.label}</text>)}
      {horizontalGridLines.map((line) => <g key={`axis-${line.ratio}`}>
        <text className="chart-axis-label" x={PLOT.left - 13} y={PLOT.bottom - line.ratio * (PLOT.bottom - PLOT.top) + 4} textAnchor="end">{Math.round(12 * line.ratio)}</text>
      </g>)}
      <text className="chart-axis-title" x={PLOT.left - 13} y="18">bar / ml/s</text>
      <g clipPath={`url(#${gradientId}-plot)`}>
        <g className="live-shot-chart__context-lines" opacity={layerOpacity.contextOpacity} aria-hidden="true">
          <path className={`chart-area chart-area--pressure${lineClass(chartSeriesForLine.pressure)}`} fill={`url(#${gradientId}-pressure-area)`} d={areaPath(displayPlottedPoints, 'pressure', xForElapsedMs, 0, 12)} />
          <path className={`chart-area chart-area--flow${lineClass(chartSeriesForLine.flow)}`} fill={`url(#${gradientId}-flow-area)`} d={areaPath(displayPlottedPoints, 'flow', xForElapsedMs, 0, 12)} />
          <path className={`chart-area chart-area--temperature${lineClass(chartSeriesForLine.temperature)}`} fill={`url(#${gradientId}-temperature-area)`} d={areaPath(displayPlottedPoints, 'temperature', xForElapsedMs, 70, 100)} />
          <path className={`chart-line chart-line--target-pressure${lineClass(chartSeriesForLine.targetPressure)}`} d={linePath(plottedPoints, 'targetPressure', xForElapsedMs, 0, 12)} />
          <path className={`chart-line chart-line--target-flow${lineClass(chartSeriesForLine.targetFlow)}`} d={linePath(plottedPoints, 'targetFlow', xForElapsedMs, 0, 12)} />
          <path className={`chart-line chart-line--temperature${lineClass(chartSeriesForLine.temperature)}`} d={linePath(displayPlottedPoints, 'temperature', xForElapsedMs, 70, 100)} />
          <path className={`chart-line chart-line--pressure${lineClass(chartSeriesForLine.pressure)}`} d={linePath(displayPlottedPoints, 'pressure', xForElapsedMs, 0, 12)} />
          <path className={`chart-line chart-line--flow${lineClass(chartSeriesForLine.flow)}`} d={linePath(displayPlottedPoints, 'flow', xForElapsedMs, 0, 12)} />
          {showWeight && <path className={`chart-line chart-line--weight${lineClass(chartSeriesForLine.weight)}`} d={linePath(plottedPoints, 'weight', xForElapsedMs, 0, weightMax)} />}
        </g>
        {focusPoints.length > 0 && <g className="live-shot-chart__focus-lines" opacity={layerOpacity.focusOpacity}>
          <path className={`chart-area chart-area--pressure${lineClass(chartSeriesForLine.pressure)}`} fill={`url(#${gradientId}-pressure-area)`} d={areaPath(displayFocusPoints, 'pressure', xForElapsedMs, 0, 12)} />
          <path className={`chart-area chart-area--flow${lineClass(chartSeriesForLine.flow)}`} fill={`url(#${gradientId}-flow-area)`} d={areaPath(displayFocusPoints, 'flow', xForElapsedMs, 0, 12)} />
          <path className={`chart-area chart-area--temperature${lineClass(chartSeriesForLine.temperature)}`} fill={`url(#${gradientId}-temperature-area)`} d={areaPath(displayFocusPoints, 'temperature', xForElapsedMs, 70, 100)} />
          <path className={`chart-line chart-line--target-pressure${lineClass(chartSeriesForLine.targetPressure)}`} d={linePath(focusPoints, 'targetPressure', xForElapsedMs, 0, 12)} />
          <path className={`chart-line chart-line--target-flow${lineClass(chartSeriesForLine.targetFlow)}`} d={linePath(focusPoints, 'targetFlow', xForElapsedMs, 0, 12)} />
          <path className={`chart-line chart-line--temperature${lineClass(chartSeriesForLine.temperature)}`} d={linePath(displayFocusPoints, 'temperature', xForElapsedMs, 70, 100)} />
          <path className={`chart-line chart-line--pressure${lineClass(chartSeriesForLine.pressure)}`} d={linePath(displayFocusPoints, 'pressure', xForElapsedMs, 0, 12)} />
          <path className={`chart-line chart-line--flow${lineClass(chartSeriesForLine.flow)}`} d={linePath(displayFocusPoints, 'flow', xForElapsedMs, 0, 12)} />
          {showWeight && <path className={`chart-line chart-line--weight${lineClass(chartSeriesForLine.weight)}`} d={linePath(focusPoints, 'weight', xForElapsedMs, 0, weightMax)} />}
        </g>}
        {inspection && inspectionX !== null && <g className="chart-inspection-cursor" aria-hidden="true">
          <line x1={inspectionX} x2={inspectionX} y1={PLOT.top} y2={PLOT.bottom} />
        </g>}
      </g>
    </svg>
    {inspection && inspectionX !== null && <div className="chart-inspection-points" aria-hidden="true">
      {inspectionPressureY !== null && <i className="chart-inspection-point chart-inspection-point--pressure" style={{ left: `${inspectionX / VIEW_WIDTH * 100}%`, top: `${inspectionPressureY / VIEW_HEIGHT * 100}%` }} />}
      {inspectionFlowY !== null && <i className="chart-inspection-point chart-inspection-point--flow" style={{ left: `${inspectionX / VIEW_WIDTH * 100}%`, top: `${inspectionFlowY / VIEW_HEIGHT * 100}%` }} />}
      {inspectionTemperatureY !== null && <i className="chart-inspection-point chart-inspection-point--temperature" style={{ left: `${inspectionX / VIEW_WIDTH * 100}%`, top: `${inspectionTemperatureY / VIEW_HEIGHT * 100}%` }} />}
      {showWeight && inspectionWeightY !== null && <i className="chart-inspection-point chart-inspection-point--weight" style={{ left: `${inspectionX / VIEW_WIDTH * 100}%`, top: `${inspectionWeightY / VIEW_HEIGHT * 100}%` }} />}
    </div>}
    {inspection && inspectionX !== null && <aside className={`chart-inspection${inspectionX > VIEW_WIDTH * .7 ? ' chart-inspection--before' : ''}`} style={{ left: `${inspectionX / VIEW_WIDTH * 100}%` }} role="status" aria-live="polite">
      <time>{inspectionTimeLabel(inspection.elapsedMs)}</time>
      <dl>
        <div className="chart-reading--pressure"><dt>Pressure</dt><dd>{reading(inspection.pressure, 1)}<small>bar</small></dd></div>
        <div className="chart-reading--flow"><dt>Flow</dt><dd>{reading(inspection.flow, 1)}<small>ml/s</small></dd></div>
        <div className="chart-reading--temperature"><dt>Temperature</dt><dd>{formatTemperatureValue(inspection.temperature, preferences.temperatureUnit, 1)}<small className="temperature-unit">{temperatureUnitLabel(preferences.temperatureUnit)}</small></dd></div>
        {showWeight && <div className="chart-reading--weight"><dt>Yield</dt><dd>{reading(inspection.weight, 1)}<small>g</small></dd></div>}
      </dl>
    </aside>}
    {points.length === 0 && <p className="live-shot-chart__empty">Waiting for brewing telemetry…</p>}
    </div>
  </div>
}
