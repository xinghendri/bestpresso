import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { WAKE_HOLD_DURATION_MS, WakeHoldGesture } from '../src/features/sleep/wakeHoldGesture.ts'

test('requires a one-second hold duration', () => {
  assert.equal(WAKE_HOLD_DURATION_MS, 1_000)
})

test('a short release can reveal the clock but a completed hold cannot', () => {
  const gesture = new WakeHoldGesture()
  gesture.pointerDown(1, 100, 120)
  assert.equal(gesture.pointerEnd(1, true).kind, 'tap')
  assert.equal(gesture.complete(1), false)
  gesture.pointerDown(2, 100, 120)
  assert.equal(gesture.complete(2), true)
  assert.equal(gesture.pointerEnd(2, true).kind, 'none')
})

test('cancel, swipe and multiple fingers do not become clock-reveal taps', () => {
  const gesture = new WakeHoldGesture()
  gesture.pointerDown(1, 0, 0)
  assert.equal(gesture.pointerEnd(1, false).kind, 'cancel')
  gesture.pointerDown(2, 0, 0)
  gesture.pointerMove(2, 30, 0)
  assert.equal(gesture.pointerEnd(2, true).kind, 'none')
  gesture.pointerDown(3, 0, 0)
  gesture.pointerDown(4, 0, 0)
  assert.equal(gesture.pointerEnd(3, true).kind, 'none')
  assert.equal(gesture.pointerEnd(4, true).kind, 'none')
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

test('a finger whose touch-up was lost cannot block later holds once the browser reports it gone', () => {
  const gesture = new WakeHoldGesture()
  gesture.pointerDown(1, 100, 120)
  assert.equal(gesture.pointerDown(2, 300, 200).kind, 'cancel')
  gesture.pointerEnd(2)
  // finger 1's touch-up never arrives; the next touch start reports only itself as down
  gesture.syncActivePointers([])
  assert.equal(gesture.pointerDown(3, 100, 120).kind, 'start')
  assert.equal(gesture.complete(3), true)
})

test('syncing with fingers genuinely still down keeps multi-touch refused', () => {
  const gesture = new WakeHoldGesture()
  gesture.pointerDown(1, 100, 120)
  gesture.syncActivePointers([1])
  assert.equal(gesture.pointerDown(2, 300, 200).kind, 'cancel')
  assert.equal(gesture.complete(1), false)
})

test('syncing drops a candidate the browser no longer reports', () => {
  const gesture = new WakeHoldGesture()
  gesture.pointerDown(1, 100, 120)
  gesture.syncActivePointers([])
  assert.equal(gesture.complete(1), false)
})

test('the sleep screen blocks the browser gestures that would cancel a hold', () => {
  const screen = readFileSync(new URL('../src/features/sleep/SleepWakeScreen.tsx', import.meta.url), 'utf8')
  const css = readFileSync(new URL('../src/styles/index.css', import.meta.url), 'utf8')
  assert.match(screen, /addEventListener\('touchstart', block, \{ passive: false \}\)/)
  assert.match(screen, /syncActivePointers\(fingersStillDown\(event, event\.changedTouches\)\)/)
  assert.match(css, /\.sleep-screen \{[^}]*touch-action:none;/)
})
