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
  const className = `metric${compact ? ' metric--compact' : ''}`
  const readingClassName = `metric__reading${metric.highlight ? ' metric__reading--highlight' : ''}`

  if (edit) return <button className={`${className} metric__edit-button`} type="button" disabled={editDisabled} onClick={() => openAdjustment({ label: edit.title ?? metric.label, value: currentValue, unit: metric.unit, min: edit.min, max: edit.max, step: edit.step, mode: edit.mode, presets: edit.presets, onSave: edit.onSave })} aria-label={`Edit ${metric.label}, current value ${metric.value}${metric.unit ?? ''}`}>
    <span className="metric__label">{metric.label}{!editDisabled && <span className="metric__edit-indicator" aria-hidden="true">›</span>}</span>
    <span className={readingClassName}>{metric.value}{metric.unit && <small>{metric.unit}</small>}</span>
    {metric.subtext && <span className="metric__subtext">{metric.subtext}</span>}
  </button>

  return <div className={className}>
    <span className="metric__label">{metric.label}</span>
    <span className={readingClassName}>{metric.value}{metric.unit && <small>{metric.unit}</small>}</span>
    {metric.subtext && <span className="metric__subtext">{metric.subtext}</span>}
  </div>
}
