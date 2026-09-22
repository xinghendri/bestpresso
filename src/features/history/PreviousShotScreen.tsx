import { displayedShotName } from '../../i18n/dataLabels.ts'
import { useState } from 'react'
import { reconcileStageReasons } from '../brew/stageMoveOn'
import { clockOptions, type ClockFormat } from '../sleep/deviceTime'
import { useBestpressoPreferences } from '../settings/bestpressoPreferences'
import { dateFormatter, localizeDecimalText, t } from '../../i18n/index.ts'
import type { LiveShotPoint, PreviousShot, PreviousShotStatus } from '../../domain/brewing'
import { LiveBrewStages } from '../brew/LiveBrewStages'
import type { BrewStageSelection } from '../brew/LiveBrewStages'
import type { ChartSeries } from '../brew/chartSeries'
import { toggleDimmedChartSeries } from '../brew/chartSeries'
import { stageFocusedChartView } from '../brew/chartFocus'
import { LiveShotChart } from '../brew/LiveShotChart'

interface PreviousShotScreenProps {
  shots: PreviousShot[]
  initialShot: PreviousShot | null
  status: PreviousShotStatus
  onSelectShot: (shotId: string) => Promise<PreviousShot | null>
  onDismiss: () => void
  layout?: 'browser' | 'detail'
}

interface HistoryChartView {
  points: LiveShotPoint[]
  contextPoints?: LiveShotPoint[]
  elapsedMs: number
  startMs: number
  fitDuration: boolean
  showWeight: boolean
}

function AnimatedHistoryShotChart({ view }: { view: HistoryChartView }) {
  const [dimmedSeries, setDimmedSeries] = useState<ChartSeries[]>([])

  return <LiveShotChart points={view.points} contextPoints={view.contextPoints} elapsedMs={view.elapsedMs} fitDuration={view.fitDuration} startMs={view.startMs} showWeight={view.showWeight} legendFilterEnabled dimmedSeries={dimmedSeries} onToggleSeries={(series) => setDimmedSeries((current) => toggleDimmedChartSeries(current, series))} />
}

const pullTime = (timestamp: string | undefined, clockFormat: ClockFormat) => {
  if (!timestamp) return t('insights.previousShot.dateUnavailable')
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return t('insights.previousShot.dateUnavailable')
  return dateFormatter({ day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', ...clockOptions(clockFormat) }).format(date)
}

const timerLabel = (shot: PreviousShot) => {
  const seconds = Math.max(0, Math.round(Number(shot.totalTime) || (shot.points?.at(-1)?.elapsedMs ?? 0) / 1000))
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

export function PreviousShotScreen({ shots, initialShot, status, onSelectShot, onDismiss, layout = 'browser' }: PreviousShotScreenProps) {
  const { preferences } = useBestpressoPreferences()
  const firstShot = initialShot ?? shots[0] ?? null
  const [selectedId, setSelectedId] = useState(firstShot?.id)
  const [selectedShot, setSelectedShot] = useState<PreviousShot | null>(firstShot)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [stageSelection, setStageSelection] = useState<{ shotId: string | undefined; stage: BrewStageSelection } | null>(null)

  const activeId = selectedId && shots.some((shot) => shot.id === selectedId) ? selectedId : firstShot?.id
  const refreshedShot = initialShot?.id === activeId ? initialShot : shots.find((shot) => shot.id === activeId)
  const selectedActiveShot = selectedShot && selectedShot.id === activeId ? selectedShot : null
  const activeShot: PreviousShot | null = selectedActiveShot
    ? { ...selectedActiveShot, ...refreshedShot, points: refreshedShot?.points?.length ? refreshedShot.points : selectedActiveShot.points }
    : refreshedShot ?? null
  const selectedStage = stageSelection && stageSelection.shotId === activeId ? stageSelection.stage : null
  const isCleaning = activeShot?.beverageType?.toLowerCase() === 'cleaning'

  const selectShot = async (shot: PreviousShot) => {
    if (!shot.id || loadingId === shot.id) return
    setLoadError(false)
    if (shot.points?.length) {
      setSelectedId(shot.id)
      setSelectedShot(shot)
      return
    }
    setLoadingId(shot.id)
    try {
      const detailedShot = await onSelectShot(shot.id)
      if (detailedShot) {
        setSelectedId(shot.id)
        setSelectedShot(detailedShot)
      }
      else setLoadError(true)
    } catch {
      setLoadError(true)
    } finally {
      setLoadingId(null)
    }
  }

  const points = activeShot?.points ?? []
  const reasons = activeShot ? reconcileStageReasons(activeShot).stageReasons : undefined
  const elapsedMs = points.at(-1)?.elapsedMs ?? (Number(activeShot?.totalTime) || 0) * 1000

  const focusedView = stageFocusedChartView(points, elapsedMs, selectedStage)
  const chartView: HistoryChartView = {
    points: focusedView.points,
    contextPoints: focusedView.contextPoints,
    elapsedMs: focusedView.elapsedMs,
    startMs: focusedView.startMs,
    fitDuration: true,
    showWeight: !isCleaning,
  }

  return <main className={`history-browser-screen${layout === 'detail' ? ' history-browser-screen--detail' : ''}`}>
    {layout === 'browser' && <aside className="history-browser-rail">
      <header><h1>{t('insights.previousShot.title')}</h1><span>{shots.length}</span></header>
      <div className="history-browser-list" role="listbox" aria-label={t('insights.previousShot.title')}>
        {shots.map((shot, index) => <button className={`history-browser-item${shot.id === activeId ? ' history-browser-item--selected' : ''}`} type="button" role="option" aria-selected={shot.id === activeId} aria-busy={loadingId === shot.id} key={shot.id ?? `${shot.timestamp}:${index}`} onClick={() => void selectShot(shot)}>
          <strong>{displayedShotName(shot)}</strong>
          <time dateTime={shot.timestamp}>{pullTime(shot.timestamp, preferences.clockFormat)}</time>
        </button>)}
        {!shots.length && <p className="history-browser-empty">{status === 'loading' ? t('insights.previousShot.findingPulls') : t('insights.previousShot.noCupsYet')}</p>}
      </div>
    </aside>}

    <section className="history-browser-detail" aria-live="polite">
      <header className="live-pull-header">
        <div className="history-pull-title">
          <h1>{activeShot ? displayedShotName(activeShot) : t('insights.previousShot.fallbackTitle')}</h1>
          {activeShot && <time dateTime={activeShot.timestamp}>{pullTime(activeShot.timestamp, preferences.clockFormat)}</time>}
        </div>
        <div className="live-pull-header__controls">
          <div className={`live-pull-header__metrics metric-scale--medium${isCleaning ? ' live-pull-header__metrics--single' : ' live-pull-header__metrics--history'}`}>
            <div><span>{t('insights.common.duration')}</span><strong>{activeShot ? timerLabel(activeShot) : '—'}</strong></div>
            {!isCleaning && <><i aria-hidden="true" /><div><span>{t('insights.common.yield')}</span><strong>{localizeDecimalText(activeShot?.totalYield ?? '—')}{activeShot?.totalYield !== '—' && <small>g</small>}</strong></div></>}
          </div>
          <div className="live-pull-header__actions">
            <button className="live-pull-action live-pull-action--close" type="button" onClick={onDismiss}>{t('insights.common.close')}</button>
          </div>
        </div>
      </header>

      <section className={`live-pull-chart-panel history-pull-chart${loadingId ? ' history-pull-chart--loading' : ''}`} aria-label={activeShot ? t('insights.previousShot.chartAriaLabelWeight', { profile: displayedShotName(activeShot) }) : t('insights.previousShot.chartAriaLabelGeneric')}>
        {activeShot && <AnimatedHistoryShotChart view={chartView} />}
        {loadError && <p className="history-pull-error">{t('insights.previousShot.loadError')}</p>}
      </section>
      <LiveBrewStages reasons={reasons} points={points} elapsedMs={elapsedMs} finalYield={activeShot?.totalYield} showYield={!isCleaning} selectedStageKey={selectedStage?.key} onStageSelect={(stage) => setStageSelection(stage ? { shotId: activeId, stage } : null)} />
    </section>
  </main>
}
