import type { PreviousShot, PreviousShotStatus } from '../../domain/brewing'
import { MiniShotChart } from './MiniShotChart'

const emptyMessage: Record<Exclude<PreviousShotStatus, 'loaded' | 'fixture'>, string> = {
  loading: 'Loading shot history…',
  empty: 'You haven’t filled any cups yet',
  error: 'Shot history unavailable',
}

const shotTimestamp = (timestamp?: string) => {
  const date = timestamp ? new Date(timestamp) : null
  if (!date || Number.isNaN(date.getTime())) return 'Last pull'
  const now = new Date()
  const time = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date)
  const sameDay = date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate()
  if (sameDay) return `Today, ${time}`
  const day = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date)
  return `${day}, ${time}`
}

export function HistoryPanel({ shot, status, onOpen }: { shot: PreviousShot | null; status: PreviousShotStatus; onOpen: () => void }) {
  return <section className="history-section">{shot
    ? <button className="history-card" type="button" onClick={onOpen} aria-label={`Open shot history: ${shot.profileName}`}><div className="history-card__summary"><h3>{shot.profileName}</h3><time dateTime={shot.timestamp}>{shotTimestamp(shot.timestamp)}</time><div><span><small>Total yield</small>{shot.totalYield}{shot.totalYield !== '—' && <i>g</i>}</span><span><small>Total time</small>{shot.totalTime}{shot.totalTime !== '—' && <i>s</i>}</span></div></div><MiniShotChart shot={shot} /></button>
    : <article className="history-card history-card--empty" aria-live="polite"><p>{emptyMessage[status === 'loaded' || status === 'fixture' ? 'empty' : status]}</p></article>}</section>
}
