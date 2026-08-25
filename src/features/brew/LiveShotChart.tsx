import type { LiveShotPoint } from '../../domain/brewing'

interface LiveShotChartProps {
  points: LiveShotPoint[]
  elapsedMs: number
  targetYield: number
}

const VIEW_WIDTH = 1000
const VIEW_HEIGHT = 376
const PLOT = { left: 42, right: 978, top: 38, bottom: 340 }
const PLOT_BOTTOM_STROKE_ALLOWANCE = 4

const linePath = (points: LiveShotPoint[], key: keyof LiveShotPoint, durationMs: number, minimum: number, maximum: number) => {
  let path = ''
  let drawing = false
  for (const point of points) {
    const value = point[key]
    if (typeof value !== 'number') {
      drawing = false
      continue
    }
    const x = PLOT.left + Math.min(1, point.elapsedMs / durationMs) * (PLOT.right - PLOT.left)
    const ratio = Math.max(0, Math.min(1, (value - minimum) / (maximum - minimum)))
    const y = PLOT.bottom - ratio * (PLOT.bottom - PLOT.top)
    path += `${drawing ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`
    drawing = true
  }
  return path
}

export function LiveShotChart({ points, elapsedMs, targetYield }: LiveShotChartProps) {
  const durationMs = Math.max(10_000, Math.ceil(Math.max(elapsedMs, 1) / 5_000) * 5_000)
  const observedWeight = Math.max(0, ...points.map((point) => point.weight ?? 0))
  const weightMax = Math.max(50, targetYield * 1.2, observedWeight * 1.12)
  const timeTicks = Array.from({ length: durationMs / 5_000 }, (_, index) => (index + 1) * 5_000)
  const gridTicks = Array.from({ length: 5 }, (_, index) => index / 4)

  return <div className="live-shot-chart">
    <svg viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`} role="img" aria-label="Live espresso pressure, flow, yield weight, and temperature chart" preserveAspectRatio="none">
      <defs><clipPath id="live-shot-plot"><rect x={PLOT.left} y={PLOT.top} width={PLOT.right - PLOT.left} height={PLOT.bottom - PLOT.top + PLOT_BOTTOM_STROKE_ALLOWANCE} /></clipPath></defs>
      {gridTicks.map((ratio) => {
        const y = PLOT.top + ratio * (PLOT.bottom - PLOT.top)
        return <line key={`horizontal-${ratio}`} className="chart-grid chart-grid--tick" x1={PLOT.left} x2={PLOT.left + 10} y1={y} y2={y} />
      })}
      {timeTicks.map((tick) => {
        const x = PLOT.left + tick / durationMs * (PLOT.right - PLOT.left)
        return <g key={`time-${tick}`}><line className="chart-grid chart-grid--vertical" x1={x} x2={x} y1={PLOT.top} y2={PLOT.bottom} /><text className="chart-axis-label" x={x} y={PLOT.bottom + 25} textAnchor="middle">{tick / 1000}s</text></g>
      })}
      {gridTicks.map((ratio) => <g key={`axis-${ratio}`}>
        <text className="chart-axis-label" x={PLOT.left - 13} y={PLOT.bottom - ratio * (PLOT.bottom - PLOT.top) + 4} textAnchor="end">{Math.round(12 * ratio)}</text>
      </g>)}
      <text className="chart-axis-title" x={PLOT.left - 13} y={PLOT.top - 14}>bar / ml/s</text>
      <g clipPath="url(#live-shot-plot)">
        <path className="chart-line chart-line--target-pressure" d={linePath(points, 'targetPressure', durationMs, 0, 12)} />
        <path className="chart-line chart-line--target-flow" d={linePath(points, 'targetFlow', durationMs, 0, 12)} />
        <path className="chart-line chart-line--temperature" d={linePath(points, 'temperature', durationMs, 70, 100)} />
        <path className="chart-line chart-line--pressure" d={linePath(points, 'pressure', durationMs, 0, 12)} />
        <path className="chart-line chart-line--flow" d={linePath(points, 'flow', durationMs, 0, 12)} />
        <path className="chart-line chart-line--weight" d={linePath(points, 'weight', durationMs, 0, weightMax)} />
      </g>
    </svg>
    {points.length === 0 && <p className="live-shot-chart__empty">Waiting for brewing telemetry…</p>}
  </div>
}
