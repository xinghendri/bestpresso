import { useState } from 'react'
import type { PreviousShot, PreviousShotStatus } from '../../domain/brewing'
import { LiveBrewStages } from '../brew/LiveBrewStages'
import type { BrewStageSelection } from '../brew/LiveBrewStages'
import { LiveShotChart } from '../brew/LiveShotChart'

interface PreviousShotScreenProps {
  shots: PreviousShot[]
  initialShot: PreviousShot | null
  status: PreviousShotStatus
  onSelectShot: (shotId: string) => Promise<PreviousShot | null>
  onDismiss: () => void
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
  const activeShot = selectedShot?.id === activeId ? selectedShot : initialShot?.id === activeId ? initialShot : shots.find((shot) => shot.id === activeId) ?? null
  const selectedStage = stageSelection && stageSelection.shotId === activeId ? stageSelection.stage : null

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
        <div className="live-pull-header__metrics">
          <div><span>Duration</span><strong>{activeShot ? timerLabel(activeShot) : '—'}</strong></div>
          <i aria-hidden="true" />
          <div><span>Yield</span><strong>{activeShot?.totalYield ?? '—'}{activeShot?.totalYield !== '—' && <small>g</small>}</strong></div>
        </div>
        <button className="live-pull-action live-pull-action--close" type="button" onClick={onDismiss}>Close</button>
      </header>

      <section className={`live-pull-chart-panel history-pull-chart${loadingId ? ' history-pull-chart--loading' : ''}`} aria-label={activeShot ? `Shot history: ${activeShot.profileName}` : 'Shot history chart'}>
        {activeShot && <LiveShotChart points={chartPoints} elapsedMs={chartElapsedMs} startMs={chartStartMs} targetYield={targetYield} />}
        {loadError && <p className="history-pull-error">That pull couldn’t be loaded. Try selecting it again.</p>}
      </section>
      <LiveBrewStages points={points} elapsedMs={elapsedMs} selectedStageKey={selectedStage?.key} onStageSelect={(stage) => setStageSelection(stage ? { shotId: activeId, stage } : null)} />
    </section>
  </main>
}
