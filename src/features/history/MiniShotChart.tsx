import type { LiveShotPoint, PreviousShot } from '../../domain/brewing'
import { smoothShotTelemetry } from '../brew/chartSmoothing'

const WIDTH = 600
const HEIGHT = 108

const snapshotPath = (points: LiveShotPoint[], key: keyof LiveShotPoint, maximum: number, durationMs: number) => {
  let path = ''
  let drawing = false
  for (const point of points) {
    const value = point[key]
    if (typeof value !== 'number') {
      drawing = false
      continue
    }
    const x = Math.min(1, point.elapsedMs / durationMs) * WIDTH
    const y = HEIGHT - Math.max(0, Math.min(1, value / maximum)) * (HEIGHT - 5)
    path += `${drawing ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`
    drawing = true
  }
  return path
}

export function MiniShotChart({ shot }: { shot: PreviousShot }) {
  const points = shot.points ?? []
  const displayPoints = smoothShotTelemetry(points)
  const durationMs = Math.max(1, points.at(-1)?.elapsedMs ?? Number(shot.totalTime) * 1000)
  const observedWeight = Math.max(0, ...points.map((point) => point.weight ?? 0))
  const weightMax = Math.max(1, (shot.targetYield ?? observedWeight) * 1.12, observedWeight * 1.05)
  const showWeight = shot.beverageType?.toLowerCase() !== 'cleaning'

  return <div className="mini-chart">
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={showWeight ? 'Previous shot pressure, flow, and yield weight graph' : 'Previous cleaning pressure and flow graph'} preserveAspectRatio="none">
      <path className="chart-line chart-line--pressure" d={snapshotPath(displayPoints, 'pressure', 12, durationMs)} />
      <path className="chart-line chart-line--flow" d={snapshotPath(displayPoints, 'flow', 6, durationMs)} />
      {showWeight && <path className="chart-line chart-line--weight mini-chart__weight" d={snapshotPath(points, 'weight', weightMax, durationMs)} />}
    </svg>
  </div>
}
