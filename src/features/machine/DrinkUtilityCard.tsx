import { useEffect, useRef, useState, type CSSProperties } from 'react'
import hotWaterIcon from '../../assets/figma/hot-water.svg'
import steamIcon from '../../assets/figma/steam.svg'
import steamCompactConnector from '../../assets/figma/steam-compact-connector.svg'
import { Metric, type MetricEdit } from '../../components/Metric/Metric'
import { useValueAdjustment } from '../../components/ValueAdjustment/ValueAdjustmentContext'
import type { DisplayMetric, MachineUtility, UtilityMetric, UtilityMetricId } from '../../domain/brewing'
import { displayUtilityMetric, utilityLabel, utilityMetricLabel } from '../../domain/utilityLabels'
import { formatTemperatureValue, temperatureBoundToDisplay, type TemperatureUnit } from '../../domain/temperature'
import { VALUE_ADJUSTMENTS } from '../../domain/valueAdjustments'
import { t } from '../../i18n/index.ts'
import { TemperatureReading } from './TemperatureReading'
import { useHomeAnimations } from '../settings/useHomeAnimations'
import { GAUGE_MIN_C, GAUGE_CENTER, GAUGE_RADIUS, gaugeArcPath, gaugeFraction, gaugeGeometry, gaugeLayout, steamBelowReadyRange } from './steamGauge'

interface Props {
  utility: MachineUtility
  metrics: (UtilityMetric & DisplayMetric)[]
  compact: boolean
  temperatureUnit: TemperatureUnit
  disabled?: boolean
  onExpand?: () => void
  onToggleSteam: () => void
  getEdit: (metricId: UtilityMetricId) => MetricEdit | undefined
}

export function DrinkUtilityCard({ utility, metrics, compact, temperatureUnit, disabled, onExpand, onToggleSteam, getEdit }: Props) {
  const openAdjustment = useValueAdjustment()
  const steam = utility.id === 'steam'
  const animationsEnabled = useHomeAnimations()
  const temperatureSpace = useRef<HTMLDivElement>(null)
  const [tallGauge, setTallGauge] = useState(false)
  useEffect(() => {
    const element = temperatureSpace.current
    if (!steam || !element) return
    const observer = new ResizeObserver(([entry]) => {
      setTallGauge(gaugeLayout(entry.contentRect.width, entry.contentRect.height).tall)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [steam])
  const gaugeSweep = tallGauge ? 240 : 144
  const gaugeViewHeight = tallGauge ? 158 : 80
  const gaugePath = gaugeArcPath(1, gaugeSweep)
  const pending = steam && utility.enabled === undefined
  const enabled = utility.enabled === true
  const metric = (id: UtilityMetricId): UtilityMetric & DisplayMetric => metrics.find(item => item.id === id) ?? displayUtilityMetric({ id, value: '—' })
  const currentC = Number(utility.metrics.find(item => item.id === 'current')?.value)
  const targetC = Number(utility.metrics.find(item => item.id === 'target')?.value)
  const currentValid = !pending && Number.isFinite(currentC)
  const targetValid = !pending && Number.isFinite(targetC)
  const heating = steamBelowReadyRange(currentC, targetC, enabled)
  const maxC = VALUE_ADJUSTMENTS.steamTemperature.max
  const fraction = gaugeFraction(currentC, GAUGE_MIN_C, maxC)
  const marker = gaugeGeometry(targetC, GAUGE_MIN_C, maxC, gaugeSweep)
  const target = metric('target')
  const targetEdit = getEdit('target')
  const targetDisabled = pending || disabled || !targetEdit || !Number.isFinite(Number(target.value))
  const currentText = currentValid ? `${formatTemperatureValue(currentC, temperatureUnit)}°` : '—'
  const targetText = targetValid ? `${target.value}°` : '—'
  const displayMetric = (id: UtilityMetricId, displayLabel = metric(id).label) => <Metric size="small" metric={{ ...metric(id), label: displayLabel, ...(pending ? { value: '—' } : {}) }} edit={pending ? undefined : getEdit(id)} />
  const icon = steam ? steamIcon : hotWaterIcon
  const compactMetrics = steam ? metrics.map(item => pending ? { ...item, value: '—', highlight: false } : item.id === 'current' ? { ...item, value: enabled ? item.value : '—', highlight: heating } : item)
    : (['volume', 'temperature'] as const).map(metric)

  return <section className={`utility-card utility-card--${utility.id} drink-card${compact ? ' is-compact' : ''}${steam && utility.enabled === false ? ' utility-card--steam-off' : ''}${pending ? ' utility-card--steam-pending' : ''}`} data-layout={compact ? 'compact' : 'expanded'} aria-busy={pending || undefined}>
    <div className={`drink-card__face drink-card__compact utility-card--compact utility-card--${utility.id}`} inert={!compact} aria-hidden={!compact}>
      <button className="drink-card__expand" type="button" aria-label={t('shell.machine.expandToView', { label: utilityLabel(utility.id) })} onClick={onExpand} />
      <header><img src={icon} alt="" /><span>{utilityLabel(utility.id)}</span></header>
      <div className="utility-card__metrics">{compactMetrics.map(item => <Metric key={item.id} metric={item} compact size="small" />)}</div>
      {steam && <span className="utility-card__steam-connector" aria-hidden="true"><img src={steamCompactConnector} alt="" /></span>}
    </div>
    <div className="drink-card__face drink-card__expanded" inert={compact} aria-hidden={compact}>
      <header><img src={icon} alt="" /><h2>{utilityLabel(utility.id)}</h2>{steam && <button className="drink-card__toggle" type="button" role={pending ? undefined : 'switch'} aria-checked={pending ? undefined : enabled} aria-busy={pending || undefined} aria-label={pending ? t('settings.status.loading') : enabled ? t('shell.machine.disableSteamHeating') : t('shell.machine.enableSteamHeating')} disabled={pending || disabled} onClick={onToggleSteam}><span /></button>}</header>
      {!steam ? <div className="drink-card__water-settings"><div>{displayMetric('temperature')}</div><div>{displayMetric('volume')}</div></div>
        : <div className="drink-card__steam-settings">
          <div className="drink-card__temperature-space" ref={temperatureSpace}>
          <div className={`drink-card__gauge${heating ? ' is-heating' : ''}`} data-tall={tallGauge} style={{ '--gauge-target-angle': `${marker.angle}deg`, '--gauge-view-height': gaugeViewHeight } as CSSProperties}>
            <svg className="drink-card__gauge-art" viewBox={`0 0 197 ${gaugeViewHeight}`} role="meter" aria-label={t('shell.machine.steamTemperatureAria')} aria-valuemin={temperatureBoundToDisplay(GAUGE_MIN_C, temperatureUnit)} aria-valuemax={temperatureBoundToDisplay(maxC, temperatureUnit)} aria-valuenow={currentValid ? temperatureBoundToDisplay(Math.max(GAUGE_MIN_C, Math.min(maxC, currentC)), temperatureUnit) : undefined} aria-valuetext={pending ? t('settings.status.loading') : enabled ? t('shell.machine.steamGaugeValueText', { current: currentText, target: targetText }) : t('shell.machine.steamHeatingOff')}>
              <path className="drink-card__gauge-track" d={gaugePath} />
              <path className="drink-card__gauge-fill" d={gaugePath} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - fraction} data-empty={!currentValid || fraction === 0} />
              <g className="drink-card__gauge-marker" visibility={targetValid ? undefined : 'hidden'}><line x1={GAUGE_CENTER} y1={GAUGE_CENTER - GAUGE_RADIUS + 7.5} x2={GAUGE_CENTER} y2={GAUGE_CENTER - GAUGE_RADIUS - 7.5} /></g>
            </svg>
            <button className="drink-card__temperature metric__edit-button" type="button" disabled={targetDisabled} aria-label={pending ? t('settings.status.loading') : t('shell.machine.editSteamTemperatureAria', { current: enabled ? currentText : t('shell.machine.offLower'), target: targetText })} onClick={() => {
              if (targetDisabled || !targetEdit) return
              openAdjustment({ ...targetEdit, label: targetEdit.title ?? t('shell.adjust.steamTemperature.title'), value: Number(target.value), unit: '°' })
            }}>
              <span className="drink-card__temperature-pair">
                <span className="drink-card__current metric__reading" aria-hidden="true"><span className="drink-card__current-live"><TemperatureReading value={currentText} animate={animationsEnabled && !compact && enabled} /></span><span className="drink-card__current-off">{t('shell.machine.off')}</span></span>
                <svg className="drink-card__slash" viewBox="0 0 27 27" aria-hidden="true"><path d="M26.35 .35 .35 26.35" /></svg>
                <span className="drink-card__target metric__reading"><TemperatureReading value={targetText} animate={animationsEnabled && !compact} /></span>
              </span>
              <span className="metric__label">{t('common.metric.temperature')}{!targetDisabled && <span className="metric__edit-indicator" aria-hidden="true">›</span>}</span>
            </button>
          </div>
          </div>
          <div className="drink-card__steam-secondary"><div>{displayMetric('flow')}</div><div>{displayMetric('duration', utilityMetricLabel('maxDuration'))}</div></div>
        </div>}
    </div>
  </section>
}
