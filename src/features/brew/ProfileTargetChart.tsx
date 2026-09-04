import { memo, useMemo } from 'react'
import type { ProfileTargetPoint } from '../../domain/brewing'

const WIDTH = 284
const HEIGHT = 66
const VERTICAL_PADDING = 6
const PLOT_HEIGHT = HEIGHT - VERTICAL_PADDING * 2

const targetPath = (points: ProfileTargetPoint[], key: 'pressure' | 'flow', maximum: number, durationMs: number) => points.reduce((path, point, index) => {
  const value = point[key] ?? 0
  const x = Math.min(1, point.elapsedMs / durationMs) * WIDTH
  const y = HEIGHT - VERTICAL_PADDING - Math.max(0, Math.min(1, value / maximum)) * PLOT_HEIGHT
  return `${path}${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
}, '')

function ProfileTargetChartComponent({ profileName, points = [], variant = 'card' }: { profileName: string; points?: ProfileTargetPoint[]; variant?: 'card' | 'detail' }) {
  const durationMs = Math.max(1, points.at(-1)?.elapsedMs ?? 1)
  const pressurePath = useMemo(() => targetPath(points, 'pressure', 12, durationMs), [points, durationMs])
  const flowPath = useMemo(() => targetPath(points, 'flow', 6, durationMs), [points, durationMs])
  return <div className={variant === 'detail' ? 'profile-detail-chart' : 'profile-card__chart'}>
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" role="img" aria-label={`Expected pressure and flow for ${profileName}`}>
      {variant === 'detail' && <path className="profile-target-line profile-target-line--temperature" d={`M0,${(VERTICAL_PADDING + PLOT_HEIGHT * .21).toFixed(1)} L${(WIDTH * .09).toFixed(1)},${VERTICAL_PADDING} L${WIDTH},${VERTICAL_PADDING}`} />}
      <path className="profile-target-line profile-target-line--pressure" d={pressurePath} />
      <path className="profile-target-line profile-target-line--flow" d={flowPath} />
    </svg>
  </div>
}

export const ProfileTargetChart = memo(ProfileTargetChartComponent)
