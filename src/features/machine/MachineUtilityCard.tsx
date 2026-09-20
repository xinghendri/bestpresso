import { memo } from 'react'
import type { CSSProperties } from 'react'
import reservoirIcon from '../../assets/figma/reservoir.svg'
import scaleIcon from '../../assets/figma/scale.svg'
import { Metric } from '../../components/Metric/Metric'
import { scaleWeightCanTare, WATER_TANK_CAPACITY_ML } from '../../domain/brewing'
import { formatTemperatureValue, temperatureBoundToDisplay, temperatureFromDisplay, temperatureStepToDisplay, temperatureUnitLabel, type TemperatureUnit } from '../../domain/temperature'
import { useBestpressoPreferences } from '../settings/bestpressoPreferences'
import type { EditableMachineSetting, MachineUtility, ScaleConnection, UtilityMetricId } from '../../domain/brewing'
import { displayUtilityMetric, utilityLabel } from '../../domain/utilityLabels'
import { VALUE_ADJUSTMENTS } from '../../domain/valueAdjustments'
import { formatNumber, t, useLanguage } from '../../i18n/index.ts'
import { scalePresentationForDevice } from './scaleArtwork'
import { steamTargetForToggle } from './steamHeating'
import { DrinkUtilityCard } from './DrinkUtilityCard'

const withoutGenericScaleSuffix = (name: string | undefined) => {
  const title = name?.replace(/\s+scale$/i, '').trim()
  return title || name || t('common.utility.scale')
}

interface MachineUtilityCardProps {
  utility: MachineUtility
  compact?: boolean
  scale?: ScaleConnection
  onExpand?: () => void
  onSearchScale?: () => void
  onTareScale?: () => void
  scaleTarePending?: boolean
  scaleTareDisabled?: boolean
  settingsDisabled?: boolean
  onUpdateSetting?: (setting: EditableMachineSetting, value: number) => void
}

const editForMetric = (utility: MachineUtility, metricId: UtilityMetricId, temperatureUnit: TemperatureUnit, onSave?: (setting: EditableMachineSetting, value: number) => void, disabled?: boolean) => {
  if (!onSave) return undefined
  const setting: EditableMachineSetting | undefined = utility.id === 'water' && metricId === 'volume'
    ? 'hotWaterVolume'
    : utility.id === 'water' && metricId === 'temperature'
      ? 'hotWaterTemperature'
      : utility.id === 'water' && metricId === 'maxDuration'
        ? 'hotWaterDuration'
      : utility.id === 'steam' && metricId === 'target'
        ? 'steamTemperature'
        : utility.id === 'steam' && metricId === 'duration'
          ? 'steamDuration'
          : utility.id === 'steam' && metricId === 'flow'
            ? 'steamFlow'
            : undefined
  if (!setting) return undefined

  const definition = VALUE_ADJUSTMENTS[setting]
  const isTemperature = setting === 'hotWaterTemperature' || setting === 'steamTemperature'
  return {
    title: definition.title,
    min: isTemperature ? temperatureBoundToDisplay(definition.min, temperatureUnit) : definition.min,
    max: isTemperature ? temperatureBoundToDisplay(definition.max, temperatureUnit) : definition.max,
    step: isTemperature ? temperatureStepToDisplay(definition.step, temperatureUnit) : definition.step,
    mode: definition.mode,
    suggestionKey: setting,
    presets: isTemperature ? definition.suggestions.map((value) => temperatureBoundToDisplay(value, temperatureUnit)) : definition.suggestions,
    disabled,
    onSave: (value: number) => onSave(setting, isTemperature ? temperatureFromDisplay(value, temperatureUnit) : value),
  }
}

function MachineUtilityCardComponent({ utility, compact = false, scale, onExpand, onSearchScale, onTareScale, scaleTarePending = false, scaleTareDisabled = false, settingsDisabled, onUpdateSetting }: MachineUtilityCardProps) {
  useLanguage()
  const { preferences } = useBestpressoPreferences()
  const temperatureUnit = preferences.temperatureUnit
  if (utility.id === 'tank') {
    const metric = utility.metrics[0]
    const volume = Number(metric?.value.replaceAll(',', ''))
    const safeVolume = Number.isFinite(volume) ? Math.max(0, Math.min(WATER_TANK_CAPACITY_ML, volume)) : 0
    const fallbackLevel = safeVolume / WATER_TANK_CAPACITY_ML * 100
    const level = Math.max(0, Math.min(100, utility.levelPercent ?? fallbackLevel))
    const needsWater = Boolean(utility.alert)
    const warnsWater = !needsWater && Boolean(utility.warning)
    const valueLabel = Number.isFinite(volume) ? `${formatNumber(volume)} ${metric.unit ?? 'ml'}` : t('shell.tank.unknownLevel')
    const statusLabel = needsWater
      ? t('shell.tank.needsWater', { value: valueLabel })
      : warnsWater
        ? t('shell.tank.low', { value: valueLabel })
      : t('shell.tank.status', { value: valueLabel })
    const style = { '--reservoir-level': `${level}%` } as CSSProperties
    const className = `reservoir-meter${needsWater ? ' reservoir-meter--needs-water' : warnsWater ? ' reservoir-meter--warning' : ''}`

    return <section className={className} role="meter" aria-label={statusLabel} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level)} aria-valuetext={statusLabel} title={statusLabel} style={style}>
      <span className="reservoir-meter__icon" aria-hidden="true"><img src={reservoirIcon} alt="" /></span>
      <span className="reservoir-meter__track" aria-hidden="true"><span className="reservoir-meter__level" /></span>
    </section>
  }

  const isScale = utility.id === 'scale'
  const steamHeatingEnabled = utility.enabled === true
  const steamTarget = Number(utility.metrics.find((metric) => metric.id === 'target')?.value)
  const scaleConnected = isScale && scale?.status === 'connected'
  const connectedScaleName = scaleConnected ? scale.name || t('common.utility.scale') : undefined
  const scalePresentation = scaleConnected ? scalePresentationForDevice(connectedScaleName, scale.id) : undefined
  const scaleWeight = Number(utility.metrics[0]?.value)
  const scaleCanTare = scaleConnected && scaleWeightCanTare(scaleWeight) && Boolean(onTareScale)
  const title = scaleConnected ? scalePresentation?.displayName ?? withoutGenericScaleSuffix(connectedScaleName) : utilityLabel(utility.id)
  const metrics = utility.metrics.map((metric) => {
    const isTemperature = (utility.id === 'water' && metric.id === 'temperature')
      || (utility.id === 'steam' && (metric.id === 'current' || metric.id === 'target'))
    return displayUtilityMetric(isTemperature ? { ...metric, value: formatTemperatureValue(metric.value, temperatureUnit), unit: temperatureUnitLabel(temperatureUnit) } : metric)
  })
  if (utility.id === 'water' || utility.id === 'steam') return <DrinkUtilityCard
    utility={utility} metrics={metrics} compact={compact} temperatureUnit={temperatureUnit}
    onExpand={onExpand} disabled={settingsDisabled || !onUpdateSetting}
    getEdit={metricId => editForMetric(utility, metricId, temperatureUnit, onUpdateSetting, settingsDisabled)}
    onToggleSteam={() => onUpdateSetting?.('steamTemperature', steamTargetForToggle(!steamHeatingEnabled, steamTarget))}
  />
  const cardClassName = `utility-card utility-card--scale${compact ? ' utility-card--compact' : ''}${scalePresentation?.imageSrc ? ' utility-card--scale-with-art' : ''}`
  const expandLabel = t('shell.machine.expandToView', { label: title })

  return <section className={cardClassName} data-layout={compact ? 'compact' : 'expanded'} data-scale-model={scalePresentation?.id} data-scale-image={scalePresentation?.imageName}>
    {compact && <button className="utility-card__expand-surface" type="button" aria-label={expandLabel} onClick={onExpand} />}
    <header><img src={scaleIcon} alt="" /><span>{title}</span></header>
    {!scaleConnected
      ? <button className={compact ? 'scale-search scale-compact-summary' : 'scale-search'} type="button" onClick={onSearchScale} disabled={scale?.status === 'searching'}>{scale?.status === 'searching' ? t('shell.scale.searching') : t('shell.scale.search')}</button>
      : <div className="utility-card__metrics">{metrics.map((metric) => scaleCanTare
        ? <button className={`scale-tare-control${scaleTarePending ? ' scale-tare-control--pending' : ''}`} key={metric.id} type="button" aria-label={t('shell.scale.tareAria', { value: metric.value, unit: metric.unit ?? '' })} title={t(scaleTareDisabled ? 'brew.data.error.tareUnavailableDuringShot' : 'shell.scale.tareTitle')} disabled={scaleTarePending || scaleTareDisabled} onClick={onTareScale}>
          <Metric metric={metric} compact size="large" />
          <svg className="scale-tare-control__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6v5h-5M4 18v-5h5M6.1 9a7 7 0 0 1 11.6-2.6L20 8.8M4 15.2l2.3 2.4A7 7 0 0 0 17.9 15" /></svg>
        </button>
        : <Metric key={metric.id} metric={metric} compact size="large" />)}</div>}
    {scalePresentation?.imageSrc && <span className="scale-device-art" aria-hidden="true"><img src={scalePresentation.imageSrc} alt="" /></span>}
  </section>
}

export const MachineUtilityCard = memo(MachineUtilityCardComponent)
