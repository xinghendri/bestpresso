import type { CSSProperties, KeyboardEvent } from 'react'
import hotWaterIcon from '../../assets/figma/hot-water.svg'
import reservoirIcon from '../../assets/figma/reservoir.svg'
import scaleIcon from '../../assets/figma/scale.svg'
import steamCompactConnector from '../../assets/figma/steam-compact-connector.svg'
import steamIcon from '../../assets/figma/steam.svg'
import { Metric } from '../../components/Metric/Metric'
import { WATER_TANK_CAPACITY_ML, WATER_TANK_LOW_LEVEL_ML } from '../../domain/brewing'
import type { EditableMachineSetting, MachineUtility, ScaleConnection } from '../../domain/brewing'
import { VALUE_ADJUSTMENTS } from '../../domain/valueAdjustments'
import { scalePresentationForName } from './scaleArtwork'

const icons = { water: hotWaterIcon, steam: steamIcon, scale: scaleIcon }

const withoutGenericScaleSuffix = (name: string | undefined) => {
  const title = name?.replace(/\s+scale$/i, '').trim()
  return title || name || 'Scale'
}

interface MachineUtilityCardProps {
  utility: MachineUtility
  compact?: boolean
  scale?: ScaleConnection
  onExpand?: () => void
  onSearchScale?: () => void
  settingsDisabled?: boolean
  onUpdateSetting?: (setting: EditableMachineSetting, value: number) => void
}

const editForMetric = (utility: MachineUtility, label: string, onSave?: (setting: EditableMachineSetting, value: number) => void, disabled?: boolean) => {
  if (!onSave) return undefined
  const setting: EditableMachineSetting | undefined = utility.id === 'water' && label === 'Volume'
    ? 'hotWaterVolume'
    : utility.id === 'water' && label === 'Temp.'
      ? 'hotWaterTemperature'
      : utility.id === 'steam' && label === 'Target'
        ? 'steamTemperature'
        : utility.id === 'steam' && label === 'Max time'
          ? 'steamDuration'
          : utility.id === 'steam' && label === 'Flow'
            ? 'steamFlow'
            : undefined
  if (!setting) return undefined

  const definition = VALUE_ADJUSTMENTS[setting]
  return {
    title: definition.title,
    min: definition.min,
    max: definition.max,
    step: definition.step,
    mode: definition.mode,
    suggestionKey: setting,
    presets: definition.suggestions,
    disabled,
    onSave: (value: number) => onSave(setting, value),
  }
}

export function MachineUtilityCard({ utility, compact = false, scale, onExpand, onSearchScale, settingsDisabled, onUpdateSetting }: MachineUtilityCardProps) {
  if (utility.id === 'tank') {
    const metric = utility.metrics[0]
    const volume = Number(metric?.value.replaceAll(',', ''))
    const safeVolume = Number.isFinite(volume) ? Math.max(0, Math.min(WATER_TANK_CAPACITY_ML, volume)) : 0
    const fallbackLevel = safeVolume / WATER_TANK_CAPACITY_ML * 100
    const level = Math.max(0, Math.min(100, utility.levelPercent ?? fallbackLevel))
    const needsWater = Boolean(utility.alert) || safeVolume <= WATER_TANK_LOW_LEVEL_ML
    const warnsWater = !needsWater && Boolean(utility.warning)
    const valueLabel = Number.isFinite(volume) ? `${metric.value} ${metric.unit ?? 'ml'}` : 'unknown level'
    const statusLabel = needsWater
      ? `Water reservoir needs water, ${valueLabel}`
      : warnsWater
        ? `Water reservoir is getting low, ${valueLabel}`
      : `Water reservoir, ${valueLabel}`
    const style = { '--reservoir-level': `${level}%` } as CSSProperties
    const className = `reservoir-meter${needsWater ? ' reservoir-meter--needs-water' : warnsWater ? ' reservoir-meter--warning' : ''}`

    return <section className={className} role="meter" aria-label={statusLabel} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level)} aria-valuetext={statusLabel} title={statusLabel} style={style}>
      <span className="reservoir-meter__icon" aria-hidden="true"><img src={reservoirIcon} alt="" /></span>
      <span className="reservoir-meter__track" aria-hidden="true"><span className="reservoir-meter__level" /></span>
    </section>
  }

  const isScale = utility.id === 'scale'
  const scaleConnected = isScale && scale?.status === 'connected'
  const connectedScaleName = scaleConnected ? scale.name || 'Scale' : undefined
  const scalePresentation = scaleConnected ? scalePresentationForName(connectedScaleName) : undefined
  const title = scaleConnected ? scalePresentation?.displayName ?? withoutGenericScaleSuffix(connectedScaleName) : utility.label
  const cardClassName = `utility-card utility-card--${utility.id}${compact ? ' utility-card--compact' : ''}${scalePresentation?.imageSrc ? ' utility-card--scale-with-art' : ''}`
  const expandLabel = `Expand utility panels to view ${title}`
  const sectionIsExpandControl = compact && !isScale
  const expandWithKeyboard = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    onExpand?.()
  }

  return <section className={cardClassName} data-layout={compact ? 'compact' : 'expanded'} data-scale-model={scalePresentation?.id} data-scale-image={scalePresentation?.imageName} role={sectionIsExpandControl ? 'button' : undefined} tabIndex={sectionIsExpandControl ? 0 : undefined} aria-label={sectionIsExpandControl ? expandLabel : undefined} onClick={sectionIsExpandControl ? onExpand : undefined} onKeyDown={sectionIsExpandControl ? expandWithKeyboard : undefined}>
    {compact && isScale && <button className="utility-card__expand-surface" type="button" aria-label={expandLabel} onClick={onExpand} />}
    <header><img src={icons[utility.id]} alt="" /><span>{title}</span></header>
    {isScale && !scaleConnected
      ? <button className={compact ? 'scale-search scale-compact-summary' : 'scale-search'} type="button" onClick={onSearchScale} disabled={scale?.status === 'searching'}>{scale?.status === 'searching' ? 'Searching…' : 'Search'}</button>
      : <div className="utility-card__metrics">{utility.metrics.map((metric) => <Metric key={metric.label} metric={metric} compact edit={compact ? undefined : editForMetric(utility, metric.label, onUpdateSetting, settingsDisabled)} />)}</div>}
    {compact && utility.id === 'steam' && <span className="utility-card__steam-connector" aria-hidden="true"><img src={steamCompactConnector} alt="" /></span>}
    {scalePresentation?.imageSrc && <span className="scale-device-art" aria-hidden="true"><img src={scalePresentation.imageSrc} alt="" /></span>}
  </section>
}
