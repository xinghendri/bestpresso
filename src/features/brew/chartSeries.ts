export type ChartSeries = 'flow' | 'pressure' | 'temperature' | 'weight'

export const chartSeriesForLine = {
  flow: 'flow',
  targetFlow: 'flow',
  pressure: 'pressure',
  targetPressure: 'pressure',
  temperature: 'temperature',
  weight: 'weight',
} as const satisfies Record<string, ChartSeries>

export function toggleDimmedChartSeries(current: ChartSeries[], series: ChartSeries) {
  return current.includes(series)
    ? current.filter((candidate) => candidate !== series)
    : [...current, series]
}
