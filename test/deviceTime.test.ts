import assert from 'node:assert/strict'
import test from 'node:test'
import { formatDeviceTime } from '../src/features/sleep/deviceTime.ts'

const evening = new Date(2026, 7, 29, 21, 5)

test('explicit clock format overrides the locale and uses zero at midnight', () => {
  assert.equal(formatDeviceTime(evening, 'en-US', '24h'), '21:05')
  assert.match(formatDeviceTime(evening, 'en-GB', '12h'), /^9:05\s?pm$/i)
  assert.equal(formatDeviceTime(new Date(2026, 7, 29, 0, 5), 'en-US', '24h'), '00:05')
})

test('uses AM/PM when the device locale selects a 12-hour clock', () => {
  assert.match(formatDeviceTime(evening, 'en-US-u-hc-h12'), /^9:05\sPM$/i)
})

test('uses 24-hour time when the device locale selects a 24-hour clock', () => {
  const formatted = formatDeviceTime(evening, 'en-GB-u-hc-h23')
  assert.equal(formatted, '21:05')
  assert.doesNotMatch(formatted, /am|pm/i)
})
