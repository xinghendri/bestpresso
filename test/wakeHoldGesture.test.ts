import assert from 'node:assert/strict'
import test from 'node:test'
import { WAKE_HOLD_DURATION_MS, WakeHoldGesture } from '../src/features/sleep/wakeHoldGesture.ts'

test('requires a one-second hold duration', () => {
  assert.equal(WAKE_HOLD_DURATION_MS, 1_000)
})

test('accepts one stationary pointer that remains down', () => {
  const gesture = new WakeHoldGesture()
  assert.equal(gesture.pointerDown(1, 100, 120).kind, 'start')
  assert.equal(gesture.pointerMove(1, 108, 120).kind, 'none')
  assert.equal(gesture.complete(1), true)
})

test('rejects a swipe even if the pointer remains held', () => {
  const gesture = new WakeHoldGesture()
  gesture.pointerDown(1, 100, 120)
  assert.equal(gesture.pointerMove(1, 125, 120).kind, 'cancel')
  assert.equal(gesture.complete(1), false)
})

test('rejects multi-touch until every pointer has lifted', () => {
  const gesture = new WakeHoldGesture()
  gesture.pointerDown(1, 100, 120)
  assert.equal(gesture.pointerDown(2, 180, 120).kind, 'cancel')
  gesture.pointerEnd(2)
  assert.equal(gesture.complete(1), false)
  gesture.pointerEnd(1)
  assert.equal(gesture.pointerDown(3, 140, 160).kind, 'start')
  assert.equal(gesture.complete(3), true)
})

test('rejects a touch released before the timer completes', () => {
  const gesture = new WakeHoldGesture()
  gesture.pointerDown(1, 100, 120)
  assert.equal(gesture.pointerEnd(1).kind, 'cancel')
  assert.equal(gesture.complete(1), false)
})
