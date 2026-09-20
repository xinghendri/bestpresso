import { useMemo, useState } from 'react'
import { formatDecimal, t } from '../../i18n/index.ts'
import { displayedShotName } from '../../i18n/dataLabels.ts'
import { analyseStageMoveOn } from './stageMoveOn'
import { liveShotFlowRate, liveShotYield, type BrewingScreenModel, type LiveBrewState } from '../../domain/brewing'
import type { BrewStageSelection } from './LiveBrewStages'
import type { ChartSeries } from './chartSeries'
import { toggleDimmedChartSeries } from './chartSeries'
import { stageFocusedChartView } from './chartFocus'
import { LiveBrewStages } from './LiveBrewStages'
import { LiveShotChart } from './LiveShotChart'

interface LiveBrewingScreenProps {
  model: BrewingScreenModel
  liveBrew: LiveBrewState
  stopPending: boolean
  skipPending: boolean
  actionError: string | null
  onStop: () => void
  onSkipStage: () => Promise<boolean>
  onDismiss: () => void
}

const timedLabel = (milliseconds: number) => {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000))
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

export function LiveBrewingScreen({ model, liveBrew, stopPending, skipPending, actionError, onStop, onSkipStage, onDismiss }: LiveBrewingScreenProps) {
  const reasons = useMemo(() => analyseStageMoveOn(liveBrew.points, liveBrew.profileSteps, {
    active: liveBrew.active, evidence: liveBrew.stageEvidence, telemetryStartedAt: liveBrew.telemetryStartedAt, stopReason: liveBrew.stopReason,
  }), [liveBrew.points, liveBrew.profileSteps, liveBrew.active, liveBrew.stageEvidence, liveBrew.telemetryStartedAt, liveBrew.stopReason])
  const [dimmedSeries, setDimmedSeries] = useState<ChartSeries[]>([])
  const [stageSelection, setStageSelection] = useState<{ shotStartedAt: number | undefined; stage: BrewStageSelection } | null>(null)
  const profile = model.profiles.find((candidate) => candidate.id === model.activeProfileId) ?? model.profiles[0]
  if (!profile && !liveBrew.profileName) return null

  const profileName = liveBrew.profileName ? displayedShotName({ profileName: liveBrew.profileName, profileNameFallback: liveBrew.profileNameFallback }) : profile?.name ?? t('brew.liveScreen.espressoFallbackName')
  const isCleaning = liveBrew.kind === 'cleaning'
  const profileTargetYield = Number(profile?.targetYield)
  const targetYield = liveBrew.targetYield ?? (Number.isFinite(profileTargetYield) ? profileTargetYield : undefined)
  const weight = liveShotYield(liveBrew.scaleWeight, liveBrew.points)
  const flowRate = liveShotFlowRate(liveBrew.points)
  const displayPoints = weight !== undefined && liveBrew.points.length > 0
    ? liveBrew.points.map((point, index) => index === liveBrew.points.length - 1 ? { ...point, weight } : point)
    : liveBrew.points
  const chartElapsedMs = liveBrew.active
    ? liveBrew.elapsedMs
    : liveBrew.points.at(-1)?.elapsedMs ?? liveBrew.elapsedMs
  const selectedStage = !liveBrew.active && stageSelection && stageSelection.shotStartedAt === liveBrew.startedAt ? stageSelection.stage : null
  const chartView = stageFocusedChartView(displayPoints, chartElapsedMs, liveBrew.active ? null : selectedStage)

  return <main className="live-brew-screen">
    {actionError && <div className="system-messages"><div className="system-message system-message--error" role="alert">{actionError}</div></div>}
    <header className="live-pull-header">
      <h1>{profileName}</h1>
      <div className="live-pull-header__controls">
        <div className={`live-pull-header__metrics metric-scale--medium${isCleaning ? ' live-pull-header__metrics--single' : ' live-pull-header__metrics--live'}`} aria-live="polite">
          <div><span>{t('brew.liveScreen.timerLabel')}</span><strong>{timedLabel(liveBrew.elapsedMs)}</strong></div>
          {!isCleaning && <>
            <i aria-hidden="true" />
            <div><span>{t('brew.metric.yield')}</span><strong>{weight !== undefined ? formatDecimal(weight, 1) : '—'}<small>g</small>{targetYield !== undefined && <> <em>/</em> {formatDecimal(targetYield, Number.isInteger(targetYield) ? 0 : 1)}<small>g</small></>}</strong></div>
            <i aria-hidden="true" />
            <div><span>{t('brew.metric.flowRate')}</span><strong>{flowRate !== undefined ? formatDecimal(flowRate, 1) : '—'}<small>g/s</small></strong></div>
          </>}
        </div>
        <div className="live-pull-header__actions">
          {liveBrew.active
            ? <button className="live-pull-action live-pull-action--stop" type="button" disabled={stopPending} onClick={onStop}>{stopPending ? t('brew.liveScreen.stopping') : t('brew.liveScreen.stop')}</button>
            : <button className="live-pull-action live-pull-action--close" type="button" onClick={onDismiss} aria-label={t('brew.liveScreen.closeAriaLabel')}>{t('brew.liveScreen.close')}</button>}
        </div>
      </div>
    </header>
    <section className="live-pull-chart-panel" aria-label={t('brew.liveScreen.runningAriaLabel', { name: profileName })}>
      <LiveShotChart points={chartView.points} contextPoints={chartView.contextPoints} elapsedMs={chartView.elapsedMs} startMs={chartView.startMs} fitDuration={!liveBrew.active} showWeight={!isCleaning} legendFilterEnabled={!liveBrew.active} dimmedSeries={dimmedSeries} onToggleSeries={(series) => setDimmedSeries((current) => toggleDimmedChartSeries(current, series))} />
    </section>
    <LiveBrewStages key={liveBrew.startedAt ?? 'pending'} reasons={reasons} points={displayPoints} elapsedMs={liveBrew.elapsedMs} active={liveBrew.active} showYield={!isCleaning} skipPending={skipPending} selectedStageKey={selectedStage?.key} onStageSelect={liveBrew.active ? undefined : (stage) => setStageSelection(stage ? { shotStartedAt: liveBrew.startedAt, stage } : null)} onSkipStage={onSkipStage} />
  </main>
}
