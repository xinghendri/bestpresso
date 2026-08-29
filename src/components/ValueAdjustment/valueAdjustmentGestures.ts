import type { ValueAdjustmentMode } from '../../domain/valueAdjustments'

export function modeForShortcut(value: number, supportsModeToggle: boolean, currentMode: ValueAdjustmentMode): ValueAdjustmentMode {
  if (!supportsModeToggle) return currentMode
  return Number.isInteger(value) ? 'integer' : 'decimal'
}

export function gestureIncrement(mode: ValueAdjustmentMode, pointerCount: number, allowThreeFinger: boolean) {
  if (pointerCount === 1) return mode === 'decimal' ? 0.1 : 1
  if (pointerCount === 2) return 10
  if (pointerCount === 3 && allowThreeFinger) return 100
  return null
}

export function maximumGesturePointers(allowThreeFinger: boolean) {
  return allowThreeFinger ? 3 : 2
}
