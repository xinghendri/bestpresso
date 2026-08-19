import logo from '../../assets/figma/decent-logo.png'
import brewingIcon from '../../assets/figma/ready.svg'
import { Metric } from '../../components/Metric/Metric'
import type { LiveShotPoint, PreviousShot } from '../../domain/brewing'
import { LiveShotChart } from '../brew/LiveShotChart'

const maximumValue = (points: LiveShotPoint[], key: 'pressure' | 'flow') => {
  const values = points.flatMap((point) => typeof point[key] === 'number' ? [point[key]] : [])
  return values.length ? Math.max(...values).toFixed(1) : '—'
}

export function PreviousShotScreen({ shot, onDismiss }: { shot: PreviousShot; onDismiss: () => void }) {
  const points = shot.points ?? []
  const elapsedMs = points.at(-1)?.elapsedMs ?? (Number(shot.totalTime) || 0) * 1000
  const metrics = [
    { label: 'Total yield', value: shot.totalYield, unit: shot.totalYield === '—' ? undefined : 'g' },
    { label: 'Total time', value: shot.totalTime, unit: shot.totalTime === '—' ? undefined : 's' },
    { label: 'Peak pressure', value: maximumValue(points, 'pressure'), unit: 'bar' },
    { label: 'Peak flow', value: maximumValue(points, 'flow'), unit: 'ml/s' },
  ]

  return <main className="live-brew-screen previous-shot-screen">
    <header className="live-brew-header">
      <img className="logo" src={logo} alt="decent" />
      <button className="live-brew-status live-brew-status--done" type="button" onClick={onDismiss} aria-label="Close previous pull"><img src={brewingIcon} alt="" /><strong>Done</strong></button>
    </header>
    <section className="live-brew-panel" aria-label={`Previous pull: ${shot.profileName}`}>
      <article className="live-brew-card">
        <h1>{shot.profileName}</h1>
        <LiveShotChart points={points} elapsedMs={elapsedMs} targetYield={shot.targetYield ?? (Number(shot.totalYield) || 36)} />
      </article>
      <div className="live-brew-metrics">{metrics.map((metric) => <Metric key={metric.label} metric={metric} />)}</div>
    </section>
  </main>
}
