import { t } from '../../i18n/index.ts'
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
  { series: 'flow', labelKey: 'brew.chart.legend.flowGroup', items: [
    { labelKey: 'common.metric.flow', className: 'chart-legend__sample--flow' },
    { labelKey: 'common.metric.target', accessibleLabelKey: 'brew.chart.legend.targetFlow', className: 'chart-legend__sample--target-flow' },
  ] },
  { series: 'pressure', labelKey: 'brew.chart.legend.pressureGroup', items: [
    { labelKey: 'brew.metric.pressure', className: 'chart-legend__sample--pressure' },
    { labelKey: 'common.metric.target', accessibleLabelKey: 'brew.chart.legend.targetPressure', className: 'chart-legend__sample--target-pressure' },
  ] },
  { series: 'temperature', labelKey: 'common.metric.temperature', items: [{ labelKey: 'common.metric.temperature', className: 'chart-legend__sample--temperature' }] },
  { series: 'weight', labelKey: 'brew.metric.yieldFlow', items: [{ labelKey: 'brew.metric.yieldFlow', className: 'chart-legend__sample--weight' }] },
] as const

const profileLegend = [
  { series: 'flow', labelKey: 'common.metric.flow', items: [{ labelKey: 'common.metric.flow', className: 'chart-legend__sample--flow' }] },
  { series: 'pressure', labelKey: 'brew.metric.pressure', items: [{ labelKey: 'brew.metric.pressure', className: 'chart-legend__sample--pressure' }] },
  { series: 'temperature', labelKey: 'common.metric.temperature', items: [{ labelKey: 'common.metric.temperature', className: 'chart-legend__sample--temperature' }] },
] as const

export function ChartLegend({ mode = 'monitoring', showWeight = true, interactive = false, dimmedSeries = [], onToggleSeries, className = '' }: ChartLegendProps) {
  const groups = mode === 'profile' ? profileLegend : monitoringLegend
  return <div className={`chart-legend${interactive ? ' chart-legend--filterable' : ''}${className ? ` ${className}` : ''}`} aria-label={t('brew.chart.legend.ariaLabel')}>
    {groups.filter((group) => showWeight || group.series !== 'weight').map((group) => {
      const series = group.series as ChartSeries
      const dimmed = dimmedSeries.includes(series)
      const groupLabel = t(group.labelKey)
      const content = group.items.map((item) => <span className="chart-legend__item" aria-label={'accessibleLabelKey' in item ? t(item.accessibleLabelKey) : undefined} key={`${item.labelKey}:${item.className}`}>
        <small>{t(item.labelKey)}</small>
        <i className={`chart-legend__sample ${item.className}`} aria-hidden="true" />
      </span>)
      return interactive
        ? <button className={`chart-legend__group${dimmed ? ' chart-legend__group--dimmed' : ''}`} type="button" aria-label={t(dimmed ? 'brew.chart.legend.toggleShow' : 'brew.chart.legend.toggleDim', { label: groupLabel })} aria-pressed={!dimmed} onClick={() => onToggleSeries?.(series)} key={group.series}>{content}</button>
        : <span className="chart-legend__group" key={group.series}>{content}</span>
    })}
  </div>
}
