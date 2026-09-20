import { memo, useMemo } from 'react'
import type { LiveShotPoint, PreviousShot } from '../../domain/brewing'
import { smoothShotTelemetry } from '../brew/chartSmoothing'
import { t, useLanguage } from '../../i18n/index.ts'

const WIDTH = 600
const HEIGHT = 108

const snapshotPath = (points: LiveShotPoint[], key: keyof LiveShotPoint, maximum: number, durationMs: number) => {
  let path = ''
  let drawing = false
  for (const point of points) {
    const value = point[key]
    if (typeof value !== 'number' || !Number.isFinite(value)) {
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

function MiniShotChartComponent({ shot }: { shot: PreviousShot }) {
  // The component is memoised on `shot` alone, so a language change would not otherwise re-render it.
  useLanguage()
  const points = useMemo(() => shot.points ?? [], [shot.points])
  const displayPoints = useMemo(() => smoothShotTelemetry(points), [points])
  const durationMs = Math.max(1, points.at(-1)?.elapsedMs ?? Number(shot.totalTime) * 1000)
  const showWeight = shot.beverageType?.toLowerCase() !== 'cleaning'
  const pressurePath = useMemo(() => snapshotPath(displayPoints, 'pressure', 12, durationMs), [displayPoints, durationMs])
  const flowPath = useMemo(() => snapshotPath(displayPoints, 'flow', 6, durationMs), [displayPoints, durationMs])
  const weightPath = useMemo(() => snapshotPath(points, 'weightFlow', 6, durationMs), [points, durationMs])

  return <div className="mini-chart">
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={showWeight ? t('insights.miniChart.ariaLabelWeight') : t('insights.miniChart.ariaLabelCleaning')} preserveAspectRatio="none">
      <path className="chart-line chart-line--pressure" d={pressurePath} />
      <path className="chart-line chart-line--flow" d={flowPath} />
      {showWeight && <path className="chart-line chart-line--weight mini-chart__weight" d={weightPath} />}
    </svg>
  </div>
}

export const MiniShotChart = memo(MiniShotChartComponent)
