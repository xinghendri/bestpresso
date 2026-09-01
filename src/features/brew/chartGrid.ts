interface ChartPlot {
  left: number
  right: number
  top: number
  bottom: number
}

export const horizontalChartGridLines = (plot: ChartPlot, count = 5) => {
  const safeCount = Math.max(2, Math.floor(count))
  return Array.from({ length: safeCount }, (_, index) => {
    const ratio = index / (safeCount - 1)
    return {
      ratio,
      x1: plot.left,
      x2: plot.right,
      y: plot.top + ratio * (plot.bottom - plot.top),
    }
  })
}
