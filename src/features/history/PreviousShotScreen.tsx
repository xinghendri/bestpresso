import { useEffect, useRef, useState } from 'react'
import type { LiveShotPoint, PreviousShot, PreviousShotStatus } from '../../domain/brewing'
import { LiveBrewStages } from '../brew/LiveBrewStages'
import type { BrewStageSelection } from '../brew/LiveBrewStages'
import type { ChartSeries } from '../brew/chartSeries'
import { toggleDimmedChartSeries } from '../brew/chartSeries'
import { LiveShotChart } from '../brew/LiveShotChart'

interface PreviousShotScreenProps {
  shots: PreviousShot[]
  initialShot: PreviousShot | null
  status: PreviousShotStatus
  onSelectShot: (shotId: string) => Promise<PreviousShot | null>
  onDismiss: () => void
}

interface HistoryChartView {
  key: string
  points: LiveShotPoint[]
  contextPoints?: LiveShotPoint[]
  elapsedMs: number
  startMs: number
  fitDuration: boolean
  showWeight: boolean
}

function AnimatedHistoryShotChart({ view, targetYield }: { view: HistoryChartView; targetYield: number }) {
  const previousView = useRef(view)
  const [leavingView, setLeavingView] = useState<HistoryChartView | null>(null)
  const [dimmedSeries, setDimmedSeries] = useState<ChartSeries[]>([])

  useEffect(() => {
    const previous = previousView.current
    previousView.current = view
    if (previous.key === view.key) return
    setLeavingView(previous)
    const timeout = window.setTimeout(() => setLeavingView((current) => current?.key === previous.key ? null : current), 400)
    return () => window.clearTimeout(timeout)
  }, [view])

  const chart = (chartView: HistoryChartView, filterable = true) => <LiveShotChart points={chartView.points} contextPoints={chartView.contextPoints} elapsedMs={chartView.elapsedMs} fitDuration={chartView.fitDuration} startMs={chartView.startMs} targetYield={targetYield} showWeight={chartView.showWeight} legendFilterEnabled={filterable} dimmedSeries={dimmedSeries} onToggleSeries={filterable ? (series) => setDimmedSeries((current) => toggleDimmedChartSeries(current, series)) : undefined} />

  return <>
    {leavingView && <div className="history-chart-layer history-chart-layer--leaving" aria-hidden="true" key={`leaving:${leavingView.key}`}>{chart(leavingView, false)}</div>}
    <div className="history-chart-layer history-chart-layer--entering" key={`current:${view.key}`}>{chart(view)}</div>
  </>
}

const pullTime = (timestamp: string | undefined) => {
  if (!timestamp) return 'Date unavailable'
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return 'Date unavailable'
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date)
}

const timerLabel = (shot: PreviousShot) => {
  const seconds = Math.max(0, Math.round(Number(shot.totalTime) || (shot.points?.at(-1)?.elapsedMs ?? 0) / 1000))
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

export function PreviousShotScreen({ shots, initialShot, status, onSelectShot, onDismiss }: PreviousShotScreenProps) {
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
  const elapsedMs = points.at(-1)?.elapsedMs ?? (Number(activeShot?.totalTime) || 0) * 1000
  const targetYield = activeShot?.targetYield ?? (Number(activeShot?.totalYield) || 36)
  const chartPoints = selectedStage?.points ?? points
  const chartElapsedMs = selectedStage ? Math.max(1, selectedStage.endedAt - selectedStage.startedAt) : elapsedMs
  const chartStartMs = selectedStage?.startedAt ?? 0
  const chartView: HistoryChartView = {
    key: `${activeId ?? 'empty'}:${selectedStage?.key ?? 'full'}:${points.length}`,
    points: chartPoints,
    contextPoints: selectedStage ? points : undefined,
    elapsedMs: chartElapsedMs,
    startMs: chartStartMs,
    fitDuration: true,
    showWeight: !isCleaning,
  }

  return <main className="history-browser-screen">
    <aside className="history-browser-rail">
      <header><h1>Shot history</h1><span>{shots.length}</span></header>
      <div className="history-browser-list" role="listbox" aria-label="Shot history">
        {shots.map((shot, index) => <button className={`history-browser-item${shot.id === activeId ? ' history-browser-item--selected' : ''}`} type="button" role="option" aria-selected={shot.id === activeId} aria-busy={loadingId === shot.id} key={shot.id ?? `${shot.timestamp}:${index}`} onClick={() => void selectShot(shot)}>
          <strong>{shot.profileName}</strong>
          <time dateTime={shot.timestamp}>{pullTime(shot.timestamp)}</time>
        </button>)}
        {!shots.length && <p className="history-browser-empty">{status === 'loading' ? 'Finding your pulls…' : "You haven't filled any cups yet."}</p>}
      </div>
    </aside>

    <section className="history-browser-detail" aria-live="polite">
      <header className="live-pull-header">
        <div className="history-pull-title">
          <h1>{activeShot?.profileName ?? 'Pull history'}</h1>
          {activeShot && <time dateTime={activeShot.timestamp}>{pullTime(activeShot.timestamp)}</time>}
        </div>
        <div className={`live-pull-header__metrics${isCleaning ? ' live-pull-header__metrics--single' : ''}`}>
          <div><span>Duration</span><strong>{activeShot ? timerLabel(activeShot) : '—'}</strong></div>
          {!isCleaning && <><i aria-hidden="true" /><div><span>Yield</span><strong>{activeShot?.totalYield ?? '—'}{activeShot?.totalYield !== '—' && <small>g</small>}</strong></div></>}
        </div>
        <button className="live-pull-action live-pull-action--close" type="button" onClick={onDismiss}>Close</button>
      </header>

      <section className={`live-pull-chart-panel history-pull-chart${loadingId ? ' history-pull-chart--loading' : ''}`} aria-label={activeShot ? `Shot history: ${activeShot.profileName}` : 'Shot history chart'}>
        {activeShot && <AnimatedHistoryShotChart view={chartView} targetYield={targetYield} />}
        {loadError && <p className="history-pull-error">That pull couldn’t be loaded. Try selecting it again.</p>}
      </section>
      <LiveBrewStages points={points} elapsedMs={elapsedMs} showYield={!isCleaning} selectedStageKey={selectedStage?.key} onStageSelect={(stage) => setStageSelection(stage ? { shotId: activeId, stage } : null)} />
    </section>
  </main>
}
