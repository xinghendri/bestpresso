import type { PreviousShot } from '../../domain/brewing'
import { MiniShotChart } from './MiniShotChart'

export function HistoryPanel({ shot }: { shot: PreviousShot }) {
  return <section className="history-section"><header><h2>Previous pulls</h2><button type="button">See all</button></header><article className="history-card"><div className="history-card__summary"><h3>{shot.profileName}</h3><div><span><small>Total yield</small>{shot.totalYield}<i>g</i></span><span><small>Total time</small>{shot.totalTime}<i>s</i></span></div></div><MiniShotChart /></article></section>
}
