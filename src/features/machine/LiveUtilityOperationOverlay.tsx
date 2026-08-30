import flushIcon from '../../assets/figma/flush-live.svg'
import hotWaterIcon from '../../assets/figma/hot-water-live.svg'
import steamIcon from '../../assets/figma/steam-live.svg'
import type { ReactNode } from 'react'
import { liveHotWaterMeasurement } from '../../domain/brewing'
import type { LiveUtilityOperation } from '../../domain/brewing'

const presentation = {
  hotWater: { title: 'Dispensing hot water', icon: hotWaterIcon },
  steam: { title: 'Steaming', icon: steamIcon },
  flush: { title: 'Flushing', icon: flushIcon },
} as const

const elapsedSeconds = (elapsedMs: number) => Math.max(0, Math.floor(elapsedMs / 1000))
const decimal = (value: number) => Math.max(0, value).toFixed(1)
const temperature = (value: number | undefined) => value === undefined ? '—' : String(Math.round(value))

function Reading({ label, children, align = 'start' }: { label: string; children: ReactNode; align?: 'start' | 'center' | 'end' }) {
  return <div className={`live-utility-reading live-utility-reading--${align}`}>
    <span>{label}</span>
    <strong>{children}</strong>
  </div>
}

export function LiveUtilityOperationOverlay({ operation }: { operation: LiveUtilityOperation }) {
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
      <div className="live-utility-card__metrics">
        <Reading label="Duration">{seconds}{duration !== undefined && <> <em>/</em> {duration}</>}<small>s</small></Reading>
        {hotWaterMeasurement
          ? <Reading label={hotWaterMeasurement.label} align="center">{hotWaterMeasurement.value === undefined ? '—' : decimal(hotWaterMeasurement.value)} <em>/</em> {hotWaterMeasurement.target ?? '—'}<small>{hotWaterMeasurement.unit}</small></Reading>
          : <Reading label="Flow" align="center">{decimal(operation.flow)}<small>ml/s</small></Reading>}
        <Reading label="Temperature" align="end">{temperature(operation.temperature)}<small>°</small></Reading>
      </div>
    </section>
  </div>
}
