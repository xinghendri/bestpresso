export interface ChartStageMarker {
  key: string
  name: string
  startMs: number
  endMs: number
}

interface ChartStageMarkersProps {
  stages: ChartStageMarker[]
  highlightedKey?: string
  xForElapsedMs: (elapsedMs: number) => number
  plotLeft: number
  plotRight: number
  top: number
  bottom: number
}

export function ChartStageMarkers({ stages, highlightedKey, xForElapsedMs, plotLeft, plotRight, top, bottom }: ChartStageMarkersProps) {
  const centerY = (top + bottom) / 2
  const visibleStages = stages.map((stage, index) => {
    const startX = Math.max(plotLeft, Math.min(plotRight, xForElapsedMs(stage.startMs)))
    const endX = Math.max(plotLeft, Math.min(plotRight, xForElapsedMs(stage.endMs)))
    return { ...stage, sequence: index + 1, startX, endX, width: Math.max(0, endX - startX) }
  }).filter((stage) => stage.width > 0)

  return <g className="chart-stage-markers" aria-label="Shot stages">
    {visibleStages.map((stage, visibleIndex) => {
      const highlighted = stage.key === highlightedKey
      return <g className={`chart-stage-marker${highlighted ? ' chart-stage-marker--highlighted' : ''}`} key={stage.key}>
        {highlighted && <rect className="chart-stage-marker__highlight" x={stage.startX} y={top} width={stage.width} height={bottom - top} />}
        {visibleIndex > 0 && <line className="chart-stage-marker__separator" x1={stage.startX} x2={stage.startX} y1={top} y2={bottom} />}
        <circle className="chart-stage-marker__badge" cx={stage.startX + 12} cy={centerY} r="8" />
        <text className="chart-stage-marker__number" x={stage.startX + 12} y={centerY + 3} textAnchor="middle">{stage.sequence}</text>
        {stage.width >= 74 && <text className="chart-stage-marker__name" x={stage.startX + 25} y={centerY + 3}>{stage.name}</text>}
      </g>
    })}
  </g>
}
