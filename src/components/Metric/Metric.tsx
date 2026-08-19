import type { DisplayMetric } from '../../domain/brewing'

export function Metric({ metric, compact = false }: { metric: DisplayMetric; compact?: boolean }) {
  return <div className={`metric${compact ? ' metric--compact' : ''}`}>
    <span className="metric__label">{metric.label}</span>
    <span className={`metric__reading${metric.highlight ? ' metric__reading--highlight' : ''}`}>
      {metric.value}{metric.unit && <small>{metric.unit}</small>}
    </span>
  </div>
}
