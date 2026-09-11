import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
test('header glyphs have no baked-in background and retain their original shape', () => {
  for (const name of ['sleep', 'settings', 'fullscreen-enter', 'fullscreen-exit']) {
    const original = read(`assets/figma/${name}.svg`)
    const glyph = read(`assets/figma/${name}-glyph.svg`)
    assert.doesNotMatch(glyph, /<rect/)
    assert.equal(glyph, original.replace(/<rect[^>]+\/>\n/, ''))
  }
})
test('light header and compact controls share backgrounds, with separate heating treatment', () => {
  const css = read('styles/lightMode.css')
  assert.match(css, /\.utility-layout-toggle,\n\[data-theme="light"\] \.app-shell \.utility-card--compact[^]*?background:var\(--light-home-control\)/)
  assert.match(css, /\.status-pill--heating::after \{background:#f6e8de\}/)
  assert.match(css, /\.status-pill--heating span \{color:#864531;background:#ead0c3\}/)
  assert.match(css, /\.status-pill:not\(\.status-pill--thirsty\):not\(\.status-pill--heating\)>img/)
  assert.match(css, /\.status-pill--heating>img,\n\[data-theme="light"\] \.status-pill--thirsty>img \{filter:/)
})
test('light sleeping status uses the neutral grey treatment', () => {
  const css = read('styles/lightMode.css')
  assert.match(css, /\[data-theme="light"\] :is\(\.status-pill--sleeping,[^)]*\) \{\s*color:#5b605b;background:var\(--light-home-control\);border-color:#b5beb3;/)
})
