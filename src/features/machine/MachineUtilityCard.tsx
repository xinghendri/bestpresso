import hotWaterIcon from '../../assets/figma/hot-water.svg'
import reservoirBottom from '../../assets/figma/reservoir-bottom.svg'
import reservoirTop from '../../assets/figma/reservoir-top.svg'
import scaleIcon from '../../assets/figma/scale.svg'
import steamIcon from '../../assets/figma/steam.svg'
import { Metric } from '../../components/Metric/Metric'
import type { MachineUtility, ScaleConnection } from '../../domain/brewing'

const icons = { water: hotWaterIcon, steam: steamIcon, scale: scaleIcon }

interface MachineUtilityCardProps {
  utility: MachineUtility
  scale?: ScaleConnection
  onSearchScale?: () => void
}

export function MachineUtilityCard({ utility, scale, onSearchScale }: MachineUtilityCardProps) {
  const isScale = utility.id === 'scale'
  const scaleConnected = isScale && scale?.status === 'connected'
  const title = scaleConnected ? scale.name || 'Scale' : utility.label

  return <section className={`utility-card utility-card--${utility.id}`}>
    <header>{utility.id === 'tank' ? <span className="reservoir-icon"><img src={reservoirTop} alt="" /><img src={reservoirBottom} alt="" /></span> : <img src={icons[utility.id]} alt="" />}<span>{title}</span></header>
    {isScale && !scaleConnected
      ? <button className="scale-search" type="button" onClick={onSearchScale} disabled={scale?.status === 'searching'}>{scale?.status === 'searching' ? 'Searching…' : 'Search for scale'}</button>
      : <div className="utility-card__metrics">{utility.metrics.map((metric) => <Metric key={metric.label} metric={metric} compact />)}</div>}
  </section>
}
