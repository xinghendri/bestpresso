import { useState } from 'react'
import type { BrewingScreenModel, LiveBrewState } from '../../domain/brewing'
import type { ChartSeries } from './chartSeries'
import { toggleDimmedChartSeries } from './chartSeries'
import { LiveBrewStages } from './LiveBrewStages'
import { LiveShotChart } from './LiveShotChart'

interface LiveBrewingScreenProps {
  model: BrewingScreenModel
  liveBrew: LiveBrewState
  stopPending: boolean
  skipPending: boolean
  actionError: string | null
  onStop: () => void
  onSkipStage: () => void
  onDismiss: () => void
}

const timedLabel = (milliseconds: number) => {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000))
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

const latestWeight = (liveBrew: LiveBrewState) => {
  for (let index = liveBrew.points.length - 1; index >= 0; index -= 1) {
    const weight = liveBrew.points[index].weight
    if (typeof weight === 'number' && Number.isFinite(weight)) return Math.max(0, weight)
  }
  return undefined
}

export function LiveBrewingScreen({ model, liveBrew, stopPending, skipPending, actionError, onStop, onSkipStage, onDismiss }: LiveBrewingScreenProps) {
  const [dimmedSeries, setDimmedSeries] = useState<ChartSeries[]>([])
  const profile = model.profiles.find((candidate) => candidate.id === model.activeProfileId) ?? model.profiles[0]
  if (!profile && !liveBrew.profileName) return null

  const profileName = liveBrew.profileName ?? profile?.name ?? 'Espresso'
  const isCleaning = liveBrew.kind === 'cleaning'
  const targetYield = liveBrew.targetYield ?? (Number(profile?.targetYield) || 36)
  const weight = latestWeight(liveBrew)

  return <main className="live-brew-screen">
    {actionError && <div className="system-messages"><div className="system-message system-message--error" role="alert">{actionError}</div></div>}
    <header className="live-pull-header">
      <h1>{profileName}</h1>
      <div className={`live-pull-header__metrics${isCleaning ? ' live-pull-header__metrics--single' : ''}`} aria-live="polite">
        <div><span>Timer</span><strong>{timedLabel(liveBrew.elapsedMs)}</strong></div>
        {!isCleaning && <><i aria-hidden="true" /><div><span>Yield</span><strong>{weight?.toFixed(1) ?? '—'}<small>g</small> <em>/</em> {targetYield.toFixed(Number.isInteger(targetYield) ? 0 : 1)}<small>g</small></strong></div></>}
      </div>
      {liveBrew.active
        ? <button className="live-pull-action live-pull-action--stop" type="button" disabled={stopPending} onClick={onStop}>{stopPending ? 'Stopping…' : 'Stop'}</button>
        : <button className="live-pull-action live-pull-action--close" type="button" onClick={onDismiss} aria-label="Close completed pull">Close</button>}
    </header>
    <section className="live-pull-chart-panel" aria-label={`Running ${profileName}`}>
      <LiveShotChart points={liveBrew.points} elapsedMs={liveBrew.elapsedMs} targetYield={targetYield} showWeight={!isCleaning} legendFilterEnabled={!liveBrew.active} dimmedSeries={dimmedSeries} onToggleSeries={(series) => setDimmedSeries((current) => toggleDimmedChartSeries(current, series))} />
    </section>
    <LiveBrewStages points={liveBrew.points} elapsedMs={liveBrew.elapsedMs} active={liveBrew.active} showYield={!isCleaning} skipPending={skipPending} onSkipStage={onSkipStage} />
  </main>
}
