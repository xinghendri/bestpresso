import hotWaterIcon from '../../assets/figma/hot-water.svg'
import reservoirBottom from '../../assets/figma/reservoir-bottom.svg'
import reservoirTop from '../../assets/figma/reservoir-top.svg'
import scaleIcon from '../../assets/figma/scale.svg'
import steamIcon from '../../assets/figma/steam.svg'
import { Metric } from '../../components/Metric/Metric'
import type { EditableMachineSetting, MachineUtility, ScaleConnection } from '../../domain/brewing'

const icons = { water: hotWaterIcon, steam: steamIcon, scale: scaleIcon }

interface MachineUtilityCardProps {
  utility: MachineUtility
  scale?: ScaleConnection
  onSearchScale?: () => void
  settingsDisabled?: boolean
  onUpdateSetting?: (setting: EditableMachineSetting, value: number) => void
}

const editForMetric = (utility: MachineUtility, label: string, onSave?: (setting: EditableMachineSetting, value: number) => void, disabled?: boolean) => {
  if (!onSave) return undefined
  if (utility.id === 'water' && label === 'Volume') return { title: 'Hot water volume', min: 1, max: 500, step: 1, mode: 'integer' as const, presets: [30, 40, 50, 60, 90, 120], disabled, onSave: (value: number) => onSave('hotWaterVolume', value) }
  if (utility.id === 'water' && label === 'Temp.') return { title: 'Hot water temperature', min: 40, max: 100, step: 1, mode: 'integer' as const, presets: [82, 89, 91, 92, 97, 98], disabled, onSave: (value: number) => onSave('hotWaterTemperature', value) }
  if (utility.id === 'steam' && label === 'Target') return { title: 'Steam target temperature', min: 135, max: 165, step: 1, mode: 'integer' as const, presets: [135, 140, 145, 150, 155, 160], disabled, onSave: (value: number) => onSave('steamTemperature', value) }
  if (utility.id === 'steam' && label === 'Max time') return { title: 'Steam maximum time', min: 1, max: 120, step: 1, mode: 'integer' as const, presets: [30, 40, 50, 60, 90, 120], disabled, onSave: (value: number) => onSave('steamDuration', value) }
  if (utility.id === 'steam' && label === 'Flow') return { title: 'Steam flow', min: 0.1, max: 4, step: 0.1, mode: 'decimal' as const, presets: [0.4, 0.6, 0.8, 1, 1.2, 1.5], disabled, onSave: (value: number) => onSave('steamFlow', value) }
  return undefined
}

export function MachineUtilityCard({ utility, scale, onSearchScale, settingsDisabled, onUpdateSetting }: MachineUtilityCardProps) {
  const isScale = utility.id === 'scale'
  const scaleConnected = isScale && scale?.status === 'connected'
  const title = scaleConnected ? scale.name || 'Scale' : utility.label

  return <section className={`utility-card utility-card--${utility.id}`}>
    <header>{utility.id === 'tank' ? <span className="reservoir-icon"><img src={reservoirTop} alt="" /><img src={reservoirBottom} alt="" /></span> : <img src={icons[utility.id]} alt="" />}<span>{title}</span></header>
    {isScale && !scaleConnected
      ? <button className="scale-search" type="button" onClick={onSearchScale} disabled={scale?.status === 'searching'}>{scale?.status === 'searching' ? 'Searching…' : 'Search'}</button>
      : <div className="utility-card__metrics">{utility.metrics.map((metric) => <Metric key={metric.label} metric={metric} compact edit={editForMetric(utility, metric.label, onUpdateSetting, settingsDisabled)} />)}</div>}
  </section>
}
