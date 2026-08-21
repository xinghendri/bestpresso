import type { CSSProperties } from 'react'
import themisMiniImage from '../../assets/figma/bookoo-themis-mini.png'
import hotWaterIcon from '../../assets/figma/hot-water.svg'
import reservoirBottom from '../../assets/figma/reservoir-bottom.svg'
import reservoirTop from '../../assets/figma/reservoir-top.svg'
import scaleIcon from '../../assets/figma/scale.svg'
import steamIcon from '../../assets/figma/steam.svg'
import { Metric } from '../../components/Metric/Metric'
import { WATER_TANK_CAPACITY_ML, WATER_TANK_LOW_LEVEL_ML } from '../../domain/brewing'
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
  if (utility.id === 'tank') {
    const metric = utility.metrics[0]
    const volume = Number(metric?.value.replaceAll(',', ''))
    const safeVolume = Number.isFinite(volume) ? Math.max(0, Math.min(WATER_TANK_CAPACITY_ML, volume)) : 0
    const fallbackLevel = safeVolume / WATER_TANK_CAPACITY_ML * 100
    const level = Math.max(0, Math.min(100, utility.levelPercent ?? fallbackLevel))
    const needsWater = Boolean(utility.alert) || safeVolume <= WATER_TANK_LOW_LEVEL_ML
    const valueLabel = Number.isFinite(volume) ? `${metric.value} ${metric.unit ?? 'ml'}` : 'unknown level'
    const statusLabel = needsWater
      ? `Water reservoir needs water, ${valueLabel}`
      : `Water reservoir, ${valueLabel}`
    const style = { '--reservoir-level': `${level}%` } as CSSProperties

    return <section className={needsWater ? 'reservoir-meter reservoir-meter--needs-water' : 'reservoir-meter'} role="meter" aria-label={statusLabel} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level)} aria-valuetext={statusLabel} title={statusLabel} style={style}>
      <span className="reservoir-meter__icon" aria-hidden="true"><img src={reservoirTop} alt="" /><img src={reservoirBottom} alt="" /></span>
      <span className="reservoir-meter__track" aria-hidden="true"><span className="reservoir-meter__level" /></span>
    </section>
  }

  const isScale = utility.id === 'scale'
  const scaleConnected = isScale && scale?.status === 'connected'
  const title = scaleConnected ? scale.name || 'Scale' : utility.label
  const showThemisMini = scaleConnected && /themis[\s_-]*mini/i.test(title)
  const cardClassName = `utility-card utility-card--${utility.id}${showThemisMini ? ' utility-card--scale-themis-mini' : ''}`

  return <section className={cardClassName}>
    <header><img src={icons[utility.id]} alt="" /><span>{title}</span></header>
    {isScale && !scaleConnected
      ? <button className="scale-search" type="button" onClick={onSearchScale} disabled={scale?.status === 'searching'}>{scale?.status === 'searching' ? 'Searching…' : 'Search'}</button>
      : <div className="utility-card__metrics">{utility.metrics.map((metric) => <Metric key={metric.label} metric={metric} compact edit={editForMetric(utility, metric.label, onUpdateSetting, settingsDisabled)} />)}</div>}
    {showThemisMini && <span className="scale-device-art" aria-hidden="true"><img src={themisMiniImage} alt="" /></span>}
  </section>
}
