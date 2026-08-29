export const DOUBLE_TAP_CONFIRMATION_WINDOW_MS = 600

export interface DoubleTapConfirmation {
  confirmed: boolean
  nextTapAt: number | null
}

export function registerDoubleTap(previousTapAt: number | null, tapAt: number, windowMs = DOUBLE_TAP_CONFIRMATION_WINDOW_MS): DoubleTapConfirmation {
  const elapsed = previousTapAt === null ? Number.POSITIVE_INFINITY : tapAt - previousTapAt
  if (elapsed >= 0 && elapsed <= windowMs) return { confirmed: true, nextTapAt: null }
  return { confirmed: false, nextTapAt: tapAt }
}
