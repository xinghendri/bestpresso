import assert from 'node:assert/strict'
import test from 'node:test'
import { scaleFixtureForKey } from '../src/fixtures/scaleFixtures.ts'

test('provides Decaid-shaped fixtures for Decent scale variants', () => {
  assert.deepEqual(scaleFixtureForKey('decent'), {
    status: 'connected',
    id: 'AA:BB:CC:DD:EE:FF',
    name: 'Decent Scale',
  })
  assert.deepEqual(scaleFixtureForKey('half-decent-usb'), {
    status: 'connected',
    id: 'serial-cu.usbmodem-HDS',
    name: 'Half Decent Scale (USB)',
  })
  assert.deepEqual(scaleFixtureForKey('half-decent-wifi'), {
    status: 'connected',
    id: 'wifi:hds.local',
    name: 'Half Decent Scale (WiFi)',
  })
})

test('provides the Atomax fixture used by the collapsed scale-card regression', () => {
  assert.deepEqual(scaleFixtureForKey('atomax'), {
    status: 'connected',
    id: 'AA:BB:CC:ATOMAX',
    name: 'Atomax Skale',
  })
})

test('does not invent a fixture for an unknown key', () => {
  assert.equal(scaleFixtureForKey('unknown'), undefined)
  assert.equal(scaleFixtureForKey(null), undefined)
})
