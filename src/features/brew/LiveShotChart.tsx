import type { LiveShotPoint } from '../../domain/brewing'
import type { ChartSeries } from './chartSeries'
import { chartSeriesForLine } from './chartSeries'
import { removeOverlappingFocusedTimeTicks } from './chartTimeTicks'

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

export function LiveShotChart({ points, elapsedMs, targetYield, startMs = 0, fitDuration = false, contextPoints, showWeight = true, legendFilterEnabled = false, dimmedSeries = [], onToggleSeries }: LiveShotChartProps) {
  const durationMs = fitDuration ? Math.max(elapsedMs, 1) : Math.max(10_000, Math.ceil(Math.max(elapsedMs, 1) / 5_000) * 5_000)
  const plottedPoints = contextPoints ?? points
  const observedWeight = Math.max(0, ...plottedPoints.map((point) => point.weight ?? 0))
  const weightMax = Math.max(50, targetYield * 1.2, observedWeight * 1.12)
  const plotWidth = PLOT.right - PLOT.left
  const focusEndMs = startMs + durationMs
  const contextStartMs = plottedPoints[0]?.elapsedMs ?? startMs
  const contextEndMs = plottedPoints.at(-1)?.elapsedMs ?? focusEndMs
  const domainStartMs = contextPoints ? Math.min(contextStartMs, startMs) : startMs
  const domainEndMs = contextPoints ? Math.max(contextEndMs, focusEndMs) : focusEndMs
  const domainDurationMs = Math.max(1, domainEndMs - domainStartMs)
  const xForElapsedMs = (pointElapsedMs: number) => {
    const ratio = Math.max(0, Math.min(1, (pointElapsedMs - domainStartMs) / domainDurationMs))
    return PLOT.left + ratio * plotWidth
  }
  const intervalTicks = Array.from({ length: Math.floor(durationMs / 5_000) }, (_, index) => (index + 1) * 5_000)
  const candidateTimeTicks = fitDuration
    ? [0, ...intervalTicks, ...(durationMs % 5_000 ? [durationMs] : [])]
    : intervalTicks
  const gridTicks = Array.from({ length: 5 }, (_, index) => index / 4)
  const timeLabel = (tick: number) => {
    const seconds = (startMs + tick) / 1000
    return `${Number.isInteger(seconds) ? seconds : seconds.toFixed(1)}s`
  }
  const timeTicks = fitDuration
    ? removeOverlappingFocusedTimeTicks(candidateTimeTicks.map((offsetMs) => ({
      offsetMs,
      x: xForElapsedMs(startMs + offsetMs),
      label: timeLabel(offsetMs),
    })))
    : candidateTimeTicks.map((offsetMs) => ({ offsetMs, x: xForElapsedMs(startMs + offsetMs), label: timeLabel(offsetMs) }))
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
      {gridTicks.map((ratio) => {
        const y = PLOT.top + ratio * (PLOT.bottom - PLOT.top)
        return <line key={`horizontal-${ratio}`} className="chart-grid chart-grid--tick" x1={PLOT.left} x2={PLOT.left + 10} y1={y} y2={y} />
      })}
      {timeTicks.map((tick) => {
        return <g key={`time-${tick.offsetMs}`}><line className="chart-grid chart-grid--vertical" x1={tick.x} x2={tick.x} y1={PLOT.top} y2={PLOT.bottom} /><text className="chart-axis-label" x={tick.x} y={PLOT.bottom + 25} textAnchor="middle">{tick.label}</text></g>
      })}
      {gridTicks.map((ratio) => <g key={`axis-${ratio}`}>
        <text className="chart-axis-label" x={PLOT.left - 13} y={PLOT.bottom - ratio * (PLOT.bottom - PLOT.top) + 4} textAnchor="end">{Math.round(12 * ratio)}</text>
      </g>)}
      <text className="chart-axis-title" x={PLOT.left - 13} y={PLOT.top - 14}>bar / ml/s</text>
      <g clipPath="url(#live-shot-plot)">
        {contextPoints && <g opacity="0.15" aria-hidden="true">
          <path className={`chart-line chart-line--target-pressure${lineClass(chartSeriesForLine.targetPressure)}`} d={linePath(contextPoints, 'targetPressure', xForElapsedMs, 0, 12)} />
          <path className={`chart-line chart-line--target-flow${lineClass(chartSeriesForLine.targetFlow)}`} d={linePath(contextPoints, 'targetFlow', xForElapsedMs, 0, 12)} />
          <path className={`chart-line chart-line--temperature${lineClass(chartSeriesForLine.temperature)}`} d={linePath(contextPoints, 'temperature', xForElapsedMs, 70, 100)} />
          <path className={`chart-line chart-line--pressure${lineClass(chartSeriesForLine.pressure)}`} d={linePath(contextPoints, 'pressure', xForElapsedMs, 0, 12)} />
          <path className={`chart-line chart-line--flow${lineClass(chartSeriesForLine.flow)}`} d={linePath(contextPoints, 'flow', xForElapsedMs, 0, 12)} />
          {showWeight && <path className={`chart-line chart-line--weight${lineClass(chartSeriesForLine.weight)}`} d={linePath(contextPoints, 'weight', xForElapsedMs, 0, weightMax)} />}
        </g>}
        <path className={`chart-line chart-line--target-pressure${lineClass(chartSeriesForLine.targetPressure)}`} d={linePath(points, 'targetPressure', xForElapsedMs, 0, 12)} />
        <path className={`chart-line chart-line--target-flow${lineClass(chartSeriesForLine.targetFlow)}`} d={linePath(points, 'targetFlow', xForElapsedMs, 0, 12)} />
        <path className={`chart-line chart-line--temperature${lineClass(chartSeriesForLine.temperature)}`} d={linePath(points, 'temperature', xForElapsedMs, 70, 100)} />
        <path className={`chart-line chart-line--pressure${lineClass(chartSeriesForLine.pressure)}`} d={linePath(points, 'pressure', xForElapsedMs, 0, 12)} />
        <path className={`chart-line chart-line--flow${lineClass(chartSeriesForLine.flow)}`} d={linePath(points, 'flow', xForElapsedMs, 0, 12)} />
        {showWeight && <path className={`chart-line chart-line--weight${lineClass(chartSeriesForLine.weight)}`} d={linePath(points, 'weight', xForElapsedMs, 0, weightMax)} />}
      </g>
    </svg>
    {points.length === 0 && <p className="live-shot-chart__empty">Waiting for brewing telemetry…</p>}
  </div>
}
