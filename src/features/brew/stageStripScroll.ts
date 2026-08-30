export function latestStageScrollLeft(stageCount: number, scrollWidth: number, clientWidth: number) {
  if (stageCount <= 1) return 0
  return Math.max(0, scrollWidth - clientWidth)
}
