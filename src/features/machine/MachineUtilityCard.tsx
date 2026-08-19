import hotWaterIcon from '../../assets/figma/hot-water.svg'
import scaleIcon from '../../assets/figma/scale.svg'
import steamIcon from '../../assets/figma/steam.svg'
import { Metric } from '../../components/Metric/Metric'
import type { MachineUtility } from '../../domain/brewing'

const icons = { water: hotWaterIcon, steam: steamIcon, scale: scaleIcon, tank: scaleIcon }

export function MachineUtilityCard({ utility }: { utility: MachineUtility }) {
  return <section className={`utility-card utility-card--${utility.id}`}>
    <header><img src={icons[utility.id]} alt="" /><span>{utility.label}</span></header>
    <div className="utility-card__metrics">{utility.metrics.map((metric) => <Metric key={metric.label} metric={metric} compact />)}</div>
  </section>
}
