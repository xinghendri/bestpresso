export type ChartSeries = 'flow' | 'pressure' | 'temperature' | 'weight'

export const chartSeriesForLine = {
  flow: 'flow',
  targetFlow: 'flow',
  pressure: 'pressure',
  targetPressure: 'pressure',
  temperature: 'temperature',
  // Keep the existing brown palette/filter identity; the telemetry is g/s.
  weightFlow: 'weight',
} as const satisfies Record<string, ChartSeries>

export function toggleDimmedChartSeries(current: ChartSeries[], series: ChartSeries) {
  return current.includes(series)
    ? current.filter((candidate) => candidate !== series)
    : [...current, series]
}
