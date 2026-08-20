import type { DisplayMetric } from '../../domain/brewing'
import { useValueAdjustment } from '../ValueAdjustment/ValueAdjustmentContext'
import type { ValueAdjustmentMode } from '../ValueAdjustment/ValueAdjustmentContext'

interface MetricEdit {
  min: number
  max: number
  step: number
  mode: ValueAdjustmentMode
  title?: string
  presets?: number[]
  disabled?: boolean
  onSave: (value: number) => void
}

export function Metric({ metric, compact = false, edit }: { metric: DisplayMetric; compact?: boolean; edit?: MetricEdit }) {
  const openAdjustment = useValueAdjustment()
  const currentValue = Number(metric.value)
  const editDisabled = edit?.disabled || !Number.isFinite(currentValue)

  return <div className={`metric${compact ? ' metric--compact' : ''}`}>
    <span className="metric__label">{metric.label}</span>
    {edit
      ? <button className={`metric__reading metric__edit-button${metric.highlight ? ' metric__reading--highlight' : ''}`} type="button" disabled={editDisabled} onClick={() => openAdjustment({ label: edit.title ?? metric.label, value: currentValue, unit: metric.unit, min: edit.min, max: edit.max, step: edit.step, mode: edit.mode, presets: edit.presets, onSave: edit.onSave })} aria-label={`Edit ${metric.label}, current value ${metric.value}${metric.unit ?? ''}`}>{metric.value}{metric.unit && <small>{metric.unit}</small>}</button>
      : <span className={`metric__reading${metric.highlight ? ' metric__reading--highlight' : ''}`}>{metric.value}{metric.unit && <small>{metric.unit}</small>}</span>}
  </div>
}
