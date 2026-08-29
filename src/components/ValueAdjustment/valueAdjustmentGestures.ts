import type { ValueAdjustmentMode } from '../../domain/valueAdjustments'

export function gestureIncrement(mode: ValueAdjustmentMode, pointerCount: number, allowThreeFinger: boolean) {
  if (pointerCount === 1) return mode === 'decimal' ? 0.1 : 1
  if (pointerCount === 2) return 10
  if (pointerCount === 3 && allowThreeFinger) return 100
  return null
}

export function maximumGesturePointers(allowThreeFinger: boolean) {
  return allowThreeFinger ? 3 : 2
}

export function normalizedNumericDraft(value: string) {
  return value.replace(',', '.')
}

export function numericDraftRangeIssue(value: string, min: number, max: number): 'required' | 'below' | 'above' | null {
  const normalized = normalizedNumericDraft(value)
  if (!normalized || normalized === '.') return 'required'
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) return 'required'
  if (parsed < min) return 'below'
  if (parsed > max) return 'above'
  return null
}

export function appendNumericKey(value: string, key: string, replaceExisting = false) {
  if (!/^\d$/.test(key) && key !== '.') return value
  if (key === '.') {
    if (!replaceExisting && value.includes('.')) return value
    return replaceExisting || value === '' ? '0.' : `${value}.`
  }

  if (replaceExisting) return key
  if (value === '0') return key
  return `${value}${key}`
}

export function removeNumericKey(value: string) {
  return value.slice(0, -1)
}
