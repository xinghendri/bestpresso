import type { LiveShotPoint } from '../../domain/brewing'

interface StageFocus {
  startedAt: number
  endedAt: number
  points: LiveShotPoint[]
}

interface FocusedChartGeometry {
  contextStartMs: number
  contextEndMs: number
  focusStartMs: number
  focusEndMs: number
  plotLeft: number
  plotWidth: number
}

export interface ChartFocusTransform {
  scaleX: number
  translateX: number
}

export function stageFocusedChartView(points: LiveShotPoint[], elapsedMs: number, stage: StageFocus | null) {
  return stage ? {
    points: stage.points,
    contextPoints: points,
    elapsedMs: Math.max(1, stage.endedAt - stage.startedAt),
    startMs: stage.startedAt,
  } : {
    points,
    contextPoints: undefined,
    elapsedMs,
    startMs: 0,
  }
}

export function focusedChartX(pointElapsedMs: number, geometry: FocusedChartGeometry) {
  const transform = focusedChartTransform(geometry)
  const contextDurationMs = Math.max(1, geometry.contextEndMs - geometry.contextStartMs)
  const baseX = geometry.plotLeft + (pointElapsedMs - geometry.contextStartMs) / contextDurationMs * geometry.plotWidth
  return transform.translateX + baseX * transform.scaleX
}

export function focusedChartTransform(geometry: FocusedChartGeometry): ChartFocusTransform {
  const contextDurationMs = Math.max(1, geometry.contextEndMs - geometry.contextStartMs)
  const focusCenterMs = geometry.focusStartMs + (geometry.focusEndMs - geometry.focusStartMs) / 2
  const focusCenterX = geometry.plotLeft + (focusCenterMs - geometry.contextStartMs) / contextDurationMs * geometry.plotWidth
  const scaleX = 2
  return {
    scaleX,
    translateX: geometry.plotLeft + geometry.plotWidth / 2 - focusCenterX * scaleX,
  }
}

export function interpolateChartFocusTransform(from: ChartFocusTransform, to: ChartFocusTransform, progress: number): ChartFocusTransform {
  const boundedProgress = Math.max(0, Math.min(1, progress))
  return {
    scaleX: from.scaleX + (to.scaleX - from.scaleX) * boundedProgress,
    translateX: from.translateX + (to.translateX - from.translateX) * boundedProgress,
  }
}

export function chartFocusLayerOpacity(scaleX: number) {
  const focusProgress = Math.max(0, Math.min(1, scaleX - 1))
  return {
    contextOpacity: 1 - focusProgress * 0.85,
    focusOpacity: focusProgress,
  }
}
