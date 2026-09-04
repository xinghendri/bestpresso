import { memo, useMemo } from 'react'
import type { CSSProperties } from 'react'
import { stageMarkerCanShowName } from './chartStageMarkerLayout'

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
}

function ChartStageMarkersComponent({ stages, highlightedKey, xForElapsedMs, plotLeft, plotRight }: ChartStageMarkersProps) {
  const plotWidth = Math.max(1, plotRight - plotLeft)
  const visibleStages = useMemo(() => stages.map((stage, index) => {
    const startX = Math.max(plotLeft, Math.min(plotRight, xForElapsedMs(stage.startMs)))
    const endX = Math.max(plotLeft, Math.min(plotRight, xForElapsedMs(stage.endMs)))
    const width = Math.max(0, endX - startX)
    return {
      ...stage,
      sequence: index + 1,
      width,
      normalizedWidth: width / plotWidth * 1000,
      style: {
        '--chart-stage-left': `${(startX - plotLeft) / plotWidth * 100}%`,
        '--chart-stage-width': `${width / plotWidth * 100}%`,
      } as CSSProperties,
    }
  }).filter((stage) => stage.width > 0), [stages, plotLeft, plotRight, xForElapsedMs, plotWidth])

  return <div className="chart-stage-markers" aria-label="Shot stages">
    {visibleStages.map((stage, visibleIndex) => {
      const highlighted = stage.key === highlightedKey
      return <span className={`chart-stage-marker${visibleIndex === 0 ? ' chart-stage-marker--first' : ''}${highlighted ? ' chart-stage-marker--highlighted' : ''}`} style={stage.style} title={`${stage.sequence}. ${stage.name}`} key={stage.key}>
        <b className="chart-stage-marker__badge">{stage.sequence}</b>
        {stageMarkerCanShowName(stage.name, stage.normalizedWidth) && <span className="chart-stage-marker__name">{stage.name}</span>}
      </span>
    })}
  </div>
}

export const ChartStageMarkers = memo(ChartStageMarkersComponent)
