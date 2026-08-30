export function latestStageScrollLeft(stageCount: number, scrollWidth: number, clientWidth: number) {
  if (stageCount <= 1) return 0
  return Math.max(0, scrollWidth - clientWidth)
}

const DEFAULT_TERMINAL_INSET_PX = 16
const TERMINAL_SAFETY_PX = 2

export function stageTerminalInsets(
  clientWidth: number,
  firstCardWidth: number,
  lastCardWidth: number,
  preferredInset = DEFAULT_TERMINAL_INSET_PX,
) {
  const insetFor = (cardWidth: number) => Math.max(
    0,
    Math.min(preferredInset, clientWidth - cardWidth - TERMINAL_SAFETY_PX),
  )

  return {
    start: insetFor(firstCardWidth),
    end: insetFor(lastCardWidth),
  }
}
