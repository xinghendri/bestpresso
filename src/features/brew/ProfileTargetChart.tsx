import type { ProfileTargetPoint } from '../../domain/brewing'

const WIDTH = 284
const HEIGHT = 66

const targetPath = (points: ProfileTargetPoint[], key: 'pressure' | 'flow', maximum: number, durationMs: number) => points.reduce((path, point, index) => {
  const value = point[key] ?? 0
  const x = Math.min(1, point.elapsedMs / durationMs) * WIDTH
  const y = HEIGHT - Math.max(0, Math.min(1, value / maximum)) * (HEIGHT - 4)
  return `${path}${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
}, '')

export function ProfileTargetChart({ profileName, points = [] }: { profileName: string; points?: ProfileTargetPoint[] }) {
  const durationMs = Math.max(1, points.at(-1)?.elapsedMs ?? 1)
  return <div className="profile-card__chart">
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" role="img" aria-label={`Expected pressure and flow for ${profileName}`}>
      <path className="profile-target-line profile-target-line--pressure" d={targetPath(points, 'pressure', 12, durationMs)} />
      <path className="profile-target-line profile-target-line--flow" d={targetPath(points, 'flow', 6, durationMs)} />
    </svg>
  </div>
}
