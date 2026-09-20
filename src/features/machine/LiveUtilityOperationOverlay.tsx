import flushIcon from '../../assets/figma/flush-live.svg'
import hotWaterIcon from '../../assets/figma/hot-water-live.svg'
import steamIcon from '../../assets/figma/steam-live.svg'
import type { ReactNode } from 'react'
import { liveHotWaterMeasurement } from '../../domain/brewing'
import type { LiveUtilityOperation } from '../../domain/brewing'
import { formatTemperatureValue, temperatureUnitLabel } from '../../domain/temperature'
import { utilityMetricLabel } from '../../domain/utilityLabels'
import { t } from '../../i18n/index.ts'
import { useBestpressoPreferences } from '../settings/bestpressoPreferences'

// Getters keep this a module-level constant while still translating lazily at read time,
// the same pattern as domain/valueAdjustments.ts.
const presentation = {
  hotWater: { get title() { return t('shell.liveOperation.hotWater') }, icon: hotWaterIcon },
  steam: { get title() { return t('shell.liveOperation.steaming') }, icon: steamIcon },
  flush: { get title() { return t('shell.liveOperation.flushing') }, icon: flushIcon },
} as const

const elapsedSeconds = (elapsedMs: number) => Math.max(0, Math.floor(elapsedMs / 1000))
const decimal = (value: number) => Math.max(0, value).toFixed(1)

function Reading({ label, children, align = 'start' }: { label: string; children: ReactNode; align?: 'start' | 'center' | 'end' }) {
  return <div className={`live-utility-reading live-utility-reading--${align}`}>
    <span>{label}</span>
    <strong>{children}</strong>
  </div>
}

export function LiveUtilityOperationOverlay({ operation }: { operation: LiveUtilityOperation }) {
  const { preferences } = useBestpressoPreferences()
  const state = presentation[operation.kind]
  const seconds = elapsedSeconds(operation.elapsedMs)
  const duration = operation.targetDuration
  const hotWaterMeasurement = operation.kind === 'hotWater' ? liveHotWaterMeasurement(operation) : null

  return <div className="live-utility-overlay">
    <section className={`live-utility-card live-utility-card--${operation.kind}`} role="dialog" aria-modal="true" aria-labelledby="live-utility-title">
      <header>
        <h2 id="live-utility-title">{state.title}</h2>
        <img src={state.icon} alt="" />
      </header>
      <div className="live-utility-card__metrics metric-scale--medium">
        <Reading label={t('common.metric.duration')}>{seconds}{duration !== undefined && <> <em>/</em> {duration}</>}<small>s</small></Reading>
        {hotWaterMeasurement
          ? <Reading label={utilityMetricLabel(hotWaterMeasurement.label === 'Weight' ? 'weight' : 'volume')} align="center">{hotWaterMeasurement.value === undefined ? '—' : decimal(hotWaterMeasurement.value)} <em>/</em> {hotWaterMeasurement.target ?? '—'}<small>{hotWaterMeasurement.unit}</small></Reading>
          : <Reading label={t('common.metric.flow')} align="center">{decimal(operation.flow)}<small>ml/s</small></Reading>}
        <Reading label={t(operation.kind === 'hotWater' ? 'shell.liveOperation.targetTemperature' : 'common.metric.temperature')} align="end">{formatTemperatureValue(operation.kind === 'hotWater' ? operation.targetTemperature : operation.temperature, preferences.temperatureUnit)}<small className="temperature-unit">{temperatureUnitLabel(preferences.temperatureUnit)}</small></Reading>
      </div>
    </section>
  </div>
}
