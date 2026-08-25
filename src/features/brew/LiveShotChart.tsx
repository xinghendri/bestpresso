import type { LiveShotPoint } from '../../domain/brewing'

interface LiveShotChartProps {
  points: LiveShotPoint[]
  elapsedMs: number
  targetYield: number
  startMs?: number
  fitDuration?: boolean
  contextPoints?: LiveShotPoint[]
}

const VIEW_WIDTH = 1000
const VIEW_HEIGHT = 376
const PLOT = { left: 42, right: 978, top: 38, bottom: 340 }
const PLOT_BOTTOM_STROKE_ALLOWANCE = 4

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

export function LiveShotChart({ points, elapsedMs, targetYield, startMs = 0, fitDuration = false, contextPoints }: LiveShotChartProps) {
  const durationMs = fitDuration ? Math.max(elapsedMs, 1) : Math.max(10_000, Math.ceil(Math.max(elapsedMs, 1) / 5_000) * 5_000)
  const plottedPoints = contextPoints ?? points
  const observedWeight = Math.max(0, ...plottedPoints.map((point) => point.weight ?? 0))
  const weightMax = Math.max(50, targetYield * 1.2, observedWeight * 1.12)
  const plotWidth = PLOT.right - PLOT.left
  const focusEndMs = startMs + durationMs
  const contextStartMs = plottedPoints[0]?.elapsedMs ?? startMs
  const contextEndMs = plottedPoints.at(-1)?.elapsedMs ?? focusEndMs
  const hasLeadingContext = Boolean(contextPoints && contextStartMs < startMs)
  const hasTrailingContext = Boolean(contextPoints && contextEndMs > focusEndMs)
  const contextBand = 0.08
  const focusLeft = PLOT.left + (hasLeadingContext ? plotWidth * contextBand : 0)
  const focusRight = PLOT.right - (hasTrailingContext ? plotWidth * contextBand : 0)
  const xForElapsedMs = (pointElapsedMs: number) => {
    if (hasLeadingContext && pointElapsedMs < startMs) {
      const ratio = Math.max(0, Math.min(1, (pointElapsedMs - contextStartMs) / Math.max(1, startMs - contextStartMs)))
      return PLOT.left + ratio * (focusLeft - PLOT.left)
    }
    if (hasTrailingContext && pointElapsedMs > focusEndMs) {
      const ratio = Math.max(0, Math.min(1, (pointElapsedMs - focusEndMs) / Math.max(1, contextEndMs - focusEndMs)))
      return focusRight + ratio * (PLOT.right - focusRight)
    }
    const ratio = Math.max(0, Math.min(1, (pointElapsedMs - startMs) / durationMs))
    return focusLeft + ratio * (focusRight - focusLeft)
  }
  const intervalTicks = Array.from({ length: Math.floor(durationMs / 5_000) }, (_, index) => (index + 1) * 5_000)
  const timeTicks = fitDuration
    ? [0, ...intervalTicks, ...(durationMs % 5_000 ? [durationMs] : [])]
    : intervalTicks
  const gridTicks = Array.from({ length: 5 }, (_, index) => index / 4)
  const timeLabel = (tick: number) => {
    const seconds = (startMs + tick) / 1000
    return `${Number.isInteger(seconds) ? seconds : seconds.toFixed(1)}s`
  }

  return <div className="live-shot-chart">
    <svg viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`} role="img" aria-label="Live espresso pressure, flow, yield weight, and temperature chart" preserveAspectRatio="none">
      <defs><clipPath id="live-shot-plot"><rect x={PLOT.left} y={PLOT.top} width={PLOT.right - PLOT.left} height={PLOT.bottom - PLOT.top + PLOT_BOTTOM_STROKE_ALLOWANCE} /></clipPath></defs>
      {gridTicks.map((ratio) => {
        const y = PLOT.top + ratio * (PLOT.bottom - PLOT.top)
        return <line key={`horizontal-${ratio}`} className="chart-grid chart-grid--tick" x1={PLOT.left} x2={PLOT.left + 10} y1={y} y2={y} />
      })}
      {timeTicks.map((tick) => {
        const x = xForElapsedMs(startMs + tick)
        return <g key={`time-${tick}`}><line className="chart-grid chart-grid--vertical" x1={x} x2={x} y1={PLOT.top} y2={PLOT.bottom} /><text className="chart-axis-label" x={x} y={PLOT.bottom + 25} textAnchor="middle">{timeLabel(tick)}</text></g>
      })}
      {gridTicks.map((ratio) => <g key={`axis-${ratio}`}>
        <text className="chart-axis-label" x={PLOT.left - 13} y={PLOT.bottom - ratio * (PLOT.bottom - PLOT.top) + 4} textAnchor="end">{Math.round(12 * ratio)}</text>
      </g>)}
      <text className="chart-axis-title" x={PLOT.left - 13} y={PLOT.top - 14}>bar / ml/s</text>
      <g clipPath="url(#live-shot-plot)">
        {contextPoints && <g opacity="0.15" aria-hidden="true">
          <path className="chart-line chart-line--target-pressure" d={linePath(contextPoints, 'targetPressure', xForElapsedMs, 0, 12)} />
          <path className="chart-line chart-line--target-flow" d={linePath(contextPoints, 'targetFlow', xForElapsedMs, 0, 12)} />
          <path className="chart-line chart-line--temperature" d={linePath(contextPoints, 'temperature', xForElapsedMs, 70, 100)} />
          <path className="chart-line chart-line--pressure" d={linePath(contextPoints, 'pressure', xForElapsedMs, 0, 12)} />
          <path className="chart-line chart-line--flow" d={linePath(contextPoints, 'flow', xForElapsedMs, 0, 12)} />
          <path className="chart-line chart-line--weight" d={linePath(contextPoints, 'weight', xForElapsedMs, 0, weightMax)} />
        </g>}
        <path className="chart-line chart-line--target-pressure" d={linePath(points, 'targetPressure', xForElapsedMs, 0, 12)} />
        <path className="chart-line chart-line--target-flow" d={linePath(points, 'targetFlow', xForElapsedMs, 0, 12)} />
        <path className="chart-line chart-line--temperature" d={linePath(points, 'temperature', xForElapsedMs, 70, 100)} />
        <path className="chart-line chart-line--pressure" d={linePath(points, 'pressure', xForElapsedMs, 0, 12)} />
        <path className="chart-line chart-line--flow" d={linePath(points, 'flow', xForElapsedMs, 0, 12)} />
        <path className="chart-line chart-line--weight" d={linePath(points, 'weight', xForElapsedMs, 0, weightMax)} />
      </g>
    </svg>
    {points.length === 0 && <p className="live-shot-chart__empty">Waiting for brewing telemetry…</p>}
  </div>
}
