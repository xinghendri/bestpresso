import type { LiveShotPoint } from '../../domain/brewing'

interface LiveShotChartProps {
  points: LiveShotPoint[]
  elapsedMs: number
  targetYield: number
}

const VIEW_WIDTH = 1000
const VIEW_HEIGHT = 376
const PLOT = { left: 54, right: 946, top: 62, bottom: 326 }

const latestValue = (points: LiveShotPoint[], key: keyof LiveShotPoint) => {
  for (let index = points.length - 1; index >= 0; index -= 1) {
    const value = points[index][key]
    if (typeof value === 'number') return value
  }
  return undefined
}

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

const secondsLabel = (milliseconds: number) => {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000))
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

export function LiveShotChart({ points, elapsedMs, targetYield }: LiveShotChartProps) {
  const durationMs = Math.max(30_000, Math.ceil(Math.max(elapsedMs, 1) / 10_000) * 10_000)
  const observedWeight = Math.max(0, ...points.map((point) => point.weight ?? 0))
  const weightMax = Math.max(50, targetYield * 1.2, observedWeight * 1.12)
  const currentPressure = latestValue(points, 'pressure')
  const currentFlow = latestValue(points, 'flow')
  const currentWeight = latestValue(points, 'weight')
  const currentTemperature = latestValue(points, 'temperature')
  const timeTicks = Array.from({ length: 7 }, (_, index) => index / 6)
  const gridTicks = Array.from({ length: 5 }, (_, index) => index / 4)

  return <div className="live-shot-chart">
    <div className="live-shot-chart__summary" aria-live="polite">
      <span className="chart-reading chart-reading--pressure"><i />{currentPressure?.toFixed(1) ?? '—'} <small>bar</small></span>
      <span className="chart-reading chart-reading--flow"><i />{currentFlow?.toFixed(1) ?? '—'} <small>ml/s</small></span>
      <span className="chart-reading chart-reading--weight"><i />{currentWeight?.toFixed(1) ?? '—'} <small>g</small></span>
      <span className="chart-reading chart-reading--temperature"><i />{currentTemperature?.toFixed(1) ?? '—'} <small>°C</small></span>
      <strong>{secondsLabel(elapsedMs)}</strong>
    </div>
    <svg viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`} role="img" aria-label="Live espresso pressure, flow, yield weight, and temperature chart" preserveAspectRatio="none">
      <defs><clipPath id="live-shot-plot"><rect x={PLOT.left} y={PLOT.top} width={PLOT.right - PLOT.left} height={PLOT.bottom - PLOT.top} /></clipPath></defs>
      {gridTicks.map((ratio) => {
        const y = PLOT.top + ratio * (PLOT.bottom - PLOT.top)
        return <line key={`horizontal-${ratio}`} className="chart-grid" x1={PLOT.left} x2={PLOT.right} y1={y} y2={y} />
      })}
      {timeTicks.map((ratio) => {
        const x = PLOT.left + ratio * (PLOT.right - PLOT.left)
        return <g key={`time-${ratio}`}><line className="chart-grid chart-grid--vertical" x1={x} x2={x} y1={PLOT.top} y2={PLOT.bottom} /><text className="chart-axis-label" x={x} y={PLOT.bottom + 29} textAnchor="middle">{Math.round(durationMs * ratio / 1000)}s</text></g>
      })}
      {gridTicks.map((ratio) => <g key={`axis-${ratio}`}>
        <text className="chart-axis-label" x={PLOT.left - 13} y={PLOT.bottom - ratio * (PLOT.bottom - PLOT.top) + 4} textAnchor="end">{Math.round(12 * ratio)}</text>
        <text className="chart-axis-label" x={PLOT.right + 13} y={PLOT.bottom - ratio * (PLOT.bottom - PLOT.top) + 4}>{Math.round(weightMax * ratio)}</text>
      </g>)}
      <text className="chart-axis-title" x={PLOT.left} y={PLOT.top - 13}>bar / ml/s</text>
      <text className="chart-axis-title" x={PLOT.right} y={PLOT.top - 13} textAnchor="end">yield (g)</text>
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
