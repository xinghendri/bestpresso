import assert from 'node:assert/strict'
import test from 'node:test'
import { isSteamHeatingEnabled, steamTargetForToggle } from '../src/features/machine/steamHeating.ts'

test('uses Decaid target temperature semantics for steam heating', () => {
  assert.equal(isSteamHeatingEnabled(160), true)
  assert.equal(isSteamHeatingEnabled(135), true)
  assert.equal(isSteamHeatingEnabled(134), false)
  assert.equal(isSteamHeatingEnabled(0), false)
})

test('disables with zero and restores the displayed target when enabled', () => {
  assert.equal(steamTargetForToggle(false, 160), 0)
  assert.equal(steamTargetForToggle(true, 160), 160)
  assert.equal(steamTargetForToggle(true, 0), 135)
})
