import type { ChartSeries } from './chartSeries'

interface ChartLegendProps {
  mode?: 'monitoring' | 'profile'
  showWeight?: boolean
  interactive?: boolean
  dimmedSeries?: ChartSeries[]
  onToggleSeries?: (series: ChartSeries) => void
  className?: string
}

const monitoringLegend = [
  { series: 'flow', label: 'Flow and target flow', items: [
    { label: 'Flow', className: 'chart-legend__sample--flow' },
    { label: 'Target', accessibleLabel: 'Target flow', className: 'chart-legend__sample--target-flow' },
  ] },
  { series: 'pressure', label: 'Pressure and target pressure', items: [
    { label: 'Pressure', className: 'chart-legend__sample--pressure' },
    { label: 'Target', accessibleLabel: 'Target pressure', className: 'chart-legend__sample--target-pressure' },
  ] },
  { series: 'temperature', label: 'Temperature', items: [{ label: 'Temperature', className: 'chart-legend__sample--temperature' }] },
  { series: 'weight', label: 'Weight', items: [{ label: 'Weight', className: 'chart-legend__sample--weight' }] },
] as const

const profileLegend = [
  { series: 'flow', label: 'Flow', items: [{ label: 'Flow', className: 'chart-legend__sample--flow' }] },
  { series: 'pressure', label: 'Pressure', items: [{ label: 'Pressure', className: 'chart-legend__sample--pressure' }] },
  { series: 'temperature', label: 'Temperature', items: [{ label: 'Temperature', className: 'chart-legend__sample--temperature' }] },
] as const

export function ChartLegend({ mode = 'monitoring', showWeight = true, interactive = false, dimmedSeries = [], onToggleSeries, className = '' }: ChartLegendProps) {
  const groups = mode === 'profile' ? profileLegend : monitoringLegend
  return <div className={`chart-legend${interactive ? ' chart-legend--filterable' : ''}${className ? ` ${className}` : ''}`} aria-label="Chart legend">
    {groups.filter((group) => showWeight || group.series !== 'weight').map((group) => {
      const series = group.series as ChartSeries
      const dimmed = dimmedSeries.includes(series)
      const content = group.items.map((item) => <span className="chart-legend__item" aria-label={'accessibleLabel' in item ? item.accessibleLabel : undefined} key={`${item.label}:${item.className}`}>
        <small>{item.label}</small>
        <i className={`chart-legend__sample ${item.className}`} aria-hidden="true" />
      </span>)
      return interactive
        ? <button className={`chart-legend__group${dimmed ? ' chart-legend__group--dimmed' : ''}`} type="button" aria-label={`${dimmed ? 'Show' : 'Dim'} ${group.label}`} aria-pressed={!dimmed} onClick={() => onToggleSeries?.(series)} key={group.series}>{content}</button>
        : <span className="chart-legend__group" key={group.series}>{content}</span>
    })}
  </div>
}
