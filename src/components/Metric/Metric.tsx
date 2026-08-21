import type { DisplayMetric } from '../../domain/brewing'
import { useValueAdjustment } from '../ValueAdjustment/ValueAdjustmentContext'
import type { ValueAdjustmentMode } from '../ValueAdjustment/ValueAdjustmentContext'

interface MetricEdit {
  min: number
  max: number
  step: number
  mode: ValueAdjustmentMode
  initialValue?: number
  title?: string
  presets?: number[]
  valueHint?: (value: number) => string | undefined
  disabled?: boolean
  onSave: (value: number) => void
}

export function Metric({ metric, compact = false, edit }: { metric: DisplayMetric; compact?: boolean; edit?: MetricEdit }) {
  const openAdjustment = useValueAdjustment()
  const currentValue = Number(metric.value)
  const adjustmentValue = Number.isFinite(currentValue) ? currentValue : edit?.initialValue
  const editDisabled = Boolean(edit?.disabled) || adjustmentValue === undefined || !Number.isFinite(adjustmentValue)
  const className = `metric${compact ? ' metric--compact' : ''}`
  const readingClassName = `metric__reading${metric.highlight ? ' metric__reading--highlight' : ''}`
  const subtextClassName = `metric__subtext${metric.subtextVariant === 'pill' ? ' metric__subtext--pill' : ''}`
  const unitClassName = `metric__unit${metric.unit === '°' ? ' metric__unit--degree' : ''}`

  if (edit) return <button className={`${className} metric__edit-button`} type="button" disabled={editDisabled} onClick={() => { if (adjustmentValue !== undefined) openAdjustment({ label: edit.title ?? metric.label, value: adjustmentValue, unit: metric.unit, min: edit.min, max: edit.max, step: edit.step, mode: edit.mode, presets: edit.presets, valueHint: edit.valueHint, onSave: edit.onSave }) }} aria-label={`Edit ${metric.label}, current value ${metric.value}${metric.unit ?? ''}`}>
    <span className="metric__label">{metric.label}{!editDisabled && <span className="metric__edit-indicator" aria-hidden="true">›</span>}</span>
    <span className={readingClassName}>{metric.value}{metric.unit && <small className={unitClassName}>{metric.unit}</small>}</span>
    {metric.subtext && <span className={subtextClassName}>{metric.subtext}</span>}
  </button>

  return <div className={className}>
    <span className="metric__label">{metric.label}</span>
    <span className={readingClassName}>{metric.value}{metric.unit && <small className={unitClassName}>{metric.unit}</small>}</span>
    {metric.subtext && <span className={subtextClassName}>{metric.subtext}</span>}
  </div>
}
