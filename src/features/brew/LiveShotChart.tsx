import { useEffect, useRef, useState } from 'react'
import type { LiveShotPoint } from '../../domain/brewing'
import type { ChartSeries } from './chartSeries'
import { chartSeriesForLine } from './chartSeries'
import type { ChartFocusTransform } from './chartFocus'
import { chartFocusLayerOpacity, focusedChartTransform, interpolateChartFocusTransform } from './chartFocus'
import { horizontalChartGridLines } from './chartGrid'
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
const PLOT = { left: 42, right: 978, top: 38, bottom: 340 }
const PLOT_TOP_STROKE_ALLOWANCE = 4
const PLOT_BOTTOM_STROKE_ALLOWANCE = 4
const NORMAL_CHART_TRANSFORM: ChartFocusTransform = { scaleX: 1, translateX: 0 }
const CHART_FOCUS_TRANSITION_MS = 460

const chartLegend = [
  { series: 'flow', label: 'Flow and target flow', items: [
    { label: 'Flow', className: 'chart-legend__sample--flow' },
    { label: 'Target', accessibleLabel: 'Target flow', className: 'chart-legend__sample--target-flow' },
  ] },
  { series: 'pressure', label: 'Pressure and target pressure', items: [
    { label: 'Pressure', className: 'chart-legend__sample--pressure' },
    { label: 'Target', accessibleLabel: 'Target pressure', className: 'chart-legend__sample--target-pressure' },
  ] },
  { series: 'temperature', label: 'Temperature', items: [{ label: 'Temperature', className: 'chart-legend__sample--temperature' }] },
  { series: 'weight', label: 'Weight', items: [{ label: 'Weight', className: 'chart-legend__sample--weight' }] },
]

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

  return <div className="live-shot-chart">
    <div className={`chart-legend${legendFilterEnabled ? ' chart-legend--filterable' : ''}`} aria-label="Chart legend">
      {chartLegend.filter((group) => showWeight || group.series !== 'weight').map((group) => {
        const series = group.series as ChartSeries
        const dimmed = dimmedSeries.includes(series)
        const content = group.items.map((item) => <span className="chart-legend__item" aria-label={item.accessibleLabel} key={`${item.label}:${item.className}`}>
          <small>{item.label}</small>
          <i className={`chart-legend__sample ${item.className}`} aria-hidden="true" />
        </span>)
        return legendFilterEnabled
          ? <button className={`chart-legend__group${dimmed ? ' chart-legend__group--dimmed' : ''}`} type="button" aria-label={`${dimmed ? 'Show' : 'Dim'} ${group.label}`} aria-pressed={!dimmed} onClick={() => onToggleSeries?.(series)} key={group.series}>{content}</button>
          : <span className="chart-legend__group" key={group.series}>{content}</span>
      })}
    </div>
    <svg viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`} role="img" aria-label={showWeight ? 'Pressure, flow, yield weight, and temperature chart' : 'Pressure, flow, and temperature chart'} preserveAspectRatio="none">
      <defs><clipPath id="live-shot-plot"><rect x={PLOT.left} y={PLOT.top - PLOT_TOP_STROKE_ALLOWANCE} width={PLOT.right - PLOT.left} height={PLOT.bottom - PLOT.top + PLOT_TOP_STROKE_ALLOWANCE + PLOT_BOTTOM_STROKE_ALLOWANCE} /></clipPath></defs>
      {horizontalGridLines.map((line) => <line key={`horizontal-${line.ratio}`} className="chart-grid chart-grid--horizontal" x1={line.x1} x2={line.x2} y1={line.y} y2={line.y} />)}
      {gridTimeTicks.map((tick) => <line key={`time-grid-${tick.offsetMs}`} className="chart-grid chart-grid--vertical" x1={tick.x} x2={tick.x} y1={PLOT.top} y2={PLOT.bottom} />)}
      {timeLabels.map((tick) => <text key={`time-label-${tick.offsetMs}`} className="chart-axis-label" x={tick.x} y={PLOT.bottom + 25} textAnchor="middle">{tick.label}</text>)}
      {horizontalGridLines.map((line) => <g key={`axis-${line.ratio}`}>
        <text className="chart-axis-label" x={PLOT.left - 13} y={PLOT.bottom - line.ratio * (PLOT.bottom - PLOT.top) + 4} textAnchor="end">{Math.round(12 * line.ratio)}</text>
      </g>)}
      <text className="chart-axis-title" x={PLOT.left - 13} y={PLOT.top - 14}>bar / ml/s</text>
      <g clipPath="url(#live-shot-plot)">
        <g className="live-shot-chart__context-lines" opacity={layerOpacity.contextOpacity} aria-hidden="true">
          <path className={`chart-line chart-line--target-pressure${lineClass(chartSeriesForLine.targetPressure)}`} d={linePath(plottedPoints, 'targetPressure', xForElapsedMs, 0, 12)} />
          <path className={`chart-line chart-line--target-flow${lineClass(chartSeriesForLine.targetFlow)}`} d={linePath(plottedPoints, 'targetFlow', xForElapsedMs, 0, 12)} />
          <path className={`chart-line chart-line--temperature${lineClass(chartSeriesForLine.temperature)}`} d={linePath(displayPlottedPoints, 'temperature', xForElapsedMs, 70, 100)} />
          <path className={`chart-line chart-line--pressure${lineClass(chartSeriesForLine.pressure)}`} d={linePath(displayPlottedPoints, 'pressure', xForElapsedMs, 0, 12)} />
          <path className={`chart-line chart-line--flow${lineClass(chartSeriesForLine.flow)}`} d={linePath(displayPlottedPoints, 'flow', xForElapsedMs, 0, 12)} />
          {showWeight && <path className={`chart-line chart-line--weight${lineClass(chartSeriesForLine.weight)}`} d={linePath(plottedPoints, 'weight', xForElapsedMs, 0, weightMax)} />}
        </g>
        {focusPoints.length > 0 && <g className="live-shot-chart__focus-lines" opacity={layerOpacity.focusOpacity}>
          <path className={`chart-line chart-line--target-pressure${lineClass(chartSeriesForLine.targetPressure)}`} d={linePath(focusPoints, 'targetPressure', xForElapsedMs, 0, 12)} />
          <path className={`chart-line chart-line--target-flow${lineClass(chartSeriesForLine.targetFlow)}`} d={linePath(focusPoints, 'targetFlow', xForElapsedMs, 0, 12)} />
          <path className={`chart-line chart-line--temperature${lineClass(chartSeriesForLine.temperature)}`} d={linePath(displayFocusPoints, 'temperature', xForElapsedMs, 70, 100)} />
          <path className={`chart-line chart-line--pressure${lineClass(chartSeriesForLine.pressure)}`} d={linePath(displayFocusPoints, 'pressure', xForElapsedMs, 0, 12)} />
          <path className={`chart-line chart-line--flow${lineClass(chartSeriesForLine.flow)}`} d={linePath(displayFocusPoints, 'flow', xForElapsedMs, 0, 12)} />
          {showWeight && <path className={`chart-line chart-line--weight${lineClass(chartSeriesForLine.weight)}`} d={linePath(focusPoints, 'weight', xForElapsedMs, 0, weightMax)} />}
        </g>}
      </g>
    </svg>
    {points.length === 0 && <p className="live-shot-chart__empty">Waiting for brewing telemetry…</p>}
  </div>
}
