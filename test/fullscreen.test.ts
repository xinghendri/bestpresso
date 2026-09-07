import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fullscreenPromptVariant } from '../src/lib/fullscreen.ts'

const browser = {
  active: false,
  fullscreenSupported: true,
  ios: false,
  mobileOrTablet: true,
  standalone: false,
  webView: false,
}

test('offers fullscreen only to a supported mobile or tablet browser', () => {
  assert.equal(fullscreenPromptVariant(browser), 'fullscreen')
  assert.equal(fullscreenPromptVariant({ ...browser, mobileOrTablet: false }), 'hidden')
  assert.equal(fullscreenPromptVariant({ ...browser, fullscreenSupported: false }), 'hidden')
})

test('uses install guidance for iOS and stays hidden in standalone mode', () => {
  assert.equal(fullscreenPromptVariant({ ...browser, fullscreenSupported: false, ios: true }), 'ios')
  assert.equal(fullscreenPromptVariant({ ...browser, ios: true, standalone: true }), 'hidden')
})

test('never prompts over a Decaid webview or an active fullscreen surface', () => {
  assert.equal(fullscreenPromptVariant({ ...browser, webView: true }), 'hidden')
  assert.equal(fullscreenPromptVariant({ ...browser, active: true }), 'hidden')
})

test('defers fullscreen and update prompts during every immersive machine state', () => {
  const source = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
  assert.match(source, /const immersiveUiDeferred = data\.liveBrew\.visible \|\| Boolean\(data\.utilityOperation\) \|\| data\.sleepScreenActive/)
  assert.match(source, /<FullscreenPrompt defer=\{immersiveUiDeferred\}/)
  assert.match(source, /<DecaidUpdatePrompt defer=\{immersiveUiDeferred\}/)
})
