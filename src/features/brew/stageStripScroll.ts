export function latestStageScrollLeft(stageCount: number, scrollWidth: number, clientWidth: number) {
  if (stageCount <= 1) return 0
  return Math.max(0, scrollWidth - clientWidth)
}

export const STAGE_MOUSE_DRAG_THRESHOLD_PX = 6

export const canStartStageMouseDrag = (active: boolean, pointerType: string, button: number) => (
  !active && pointerType === 'mouse' && button === 0
)

export const stageMouseDragScrollLeft = (startScrollLeft: number, startClientX: number, currentClientX: number) => (
  startScrollLeft + startClientX - currentClientX
)
