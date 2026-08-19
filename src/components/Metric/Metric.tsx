import { useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { DisplayMetric } from '../../domain/brewing'

interface MetricEdit {
  min: number
  max: number
  step: number
  disabled?: boolean
  onSave: (value: number) => void
}

export function Metric({ metric, compact = false, edit }: { metric: DisplayMetric; compact?: boolean; edit?: MetricEdit }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(metric.value)
  const cancelBlur = useRef(false)

  const commit = () => {
    if (cancelBlur.current) {
      cancelBlur.current = false
      return
    }
    setEditing(false)
    const value = Number(draft)
    if (!edit || !Number.isFinite(value) || value < edit.min || value > edit.max || value === Number(metric.value)) return
    edit.onSave(value)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') event.currentTarget.blur()
    if (event.key === 'Escape') {
      cancelBlur.current = true
      setDraft(metric.value)
      setEditing(false)
    }
  }

  return <div className={`metric${compact ? ' metric--compact' : ''}`}>
    <span className="metric__label">{metric.label}</span>
    {editing && edit
      ? <span className={`metric__reading metric__reading--editing${metric.highlight ? ' metric__reading--highlight' : ''}`}><input autoFocus type="number" inputMode="decimal" min={edit.min} max={edit.max} step={edit.step} value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={handleKeyDown} aria-label={`Edit ${metric.label}`} />{metric.unit && <small>{metric.unit}</small>}</span>
      : edit
        ? <button className={`metric__reading metric__edit-button${metric.highlight ? ' metric__reading--highlight' : ''}`} type="button" disabled={edit.disabled} onClick={() => { setDraft(metric.value); setEditing(true) }} aria-label={`Edit ${metric.label}, current value ${metric.value}${metric.unit ?? ''}`}>{metric.value}{metric.unit && <small>{metric.unit}</small>}</button>
        : <span className={`metric__reading${metric.highlight ? ' metric__reading--highlight' : ''}`}>{metric.value}{metric.unit && <small>{metric.unit}</small>}</span>}
  </div>
}
