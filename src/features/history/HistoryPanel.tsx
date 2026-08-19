import type { PreviousShot, PreviousShotStatus } from '../../domain/brewing'
import { MiniShotChart } from './MiniShotChart'

const emptyMessage: Record<Exclude<PreviousShotStatus, 'loaded' | 'fixture'>, string> = {
  loading: 'Loading previous pull…',
  empty: 'No completed pulls yet',
  error: 'Previous pull unavailable',
}

export function HistoryPanel({ shot, status, onOpen }: { shot: PreviousShot | null; status: PreviousShotStatus; onOpen: () => void }) {
  return <section className="history-section"><header><h2>Previous pulls</h2><button type="button" disabled={!shot}>See all</button></header>{shot
    ? <button className="history-card" type="button" onClick={onOpen} aria-label={`Open previous pull: ${shot.profileName}`}><div className="history-card__summary"><h3>{shot.profileName}</h3><div><span><small>Total yield</small>{shot.totalYield}{shot.totalYield !== '—' && <i>g</i>}</span><span><small>Total time</small>{shot.totalTime}{shot.totalTime !== '—' && <i>s</i>}</span></div></div><MiniShotChart shot={shot} /></button>
    : <article className="history-card history-card--empty" aria-live="polite"><p>{emptyMessage[status === 'loaded' || status === 'fixture' ? 'empty' : status]}</p></article>}</section>
}
