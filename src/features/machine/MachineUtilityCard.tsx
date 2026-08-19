import hotWaterIcon from '../../assets/figma/hot-water.svg'
import reservoirBottom from '../../assets/figma/reservoir-bottom.svg'
import reservoirTop from '../../assets/figma/reservoir-top.svg'
import scaleIcon from '../../assets/figma/scale.svg'
import steamIcon from '../../assets/figma/steam.svg'
import { Metric } from '../../components/Metric/Metric'
import type { MachineUtility } from '../../domain/brewing'

const icons = { water: hotWaterIcon, steam: steamIcon, scale: scaleIcon }

export function MachineUtilityCard({ utility }: { utility: MachineUtility }) {
  return <section className={`utility-card utility-card--${utility.id}`}>
    <header>{utility.id === 'tank' ? <span className="reservoir-icon"><img src={reservoirTop} alt="" /><img src={reservoirBottom} alt="" /></span> : <img src={icons[utility.id]} alt="" />}<span>{utility.label}</span></header>
    <div className="utility-card__metrics">{utility.metrics.map((metric) => <Metric key={metric.label} metric={metric} compact />)}</div>
  </section>
}
