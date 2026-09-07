import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('waits for the Decaid update socket to open before sending its startup check', () => {
  const socketSource = readFileSync(new URL('../src/api/decaid/socket.ts', import.meta.url), 'utf8')
  const helperStart = socketSource.indexOf('export function subscribeWithCommands')
  const helper = socketSource.slice(helperStart)
  const openHandler = helper.indexOf("socket.addEventListener('open'")
  const openCallback = helper.indexOf('onOpen?.(send)', openHandler)

  assert.notEqual(helperStart, -1)
  assert.notEqual(openHandler, -1)
  assert.ok(openCallback > openHandler)
  assert.match(helper, /if \(!socket \|\| socket\.readyState !== WebSocket\.OPEN\) return false/)
  assert.match(helper, /socket\.send\(JSON\.stringify\(command\)\)/)
})
