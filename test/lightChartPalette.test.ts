import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const css = readFileSync(new URL('../src/styles/lightMode.css', import.meta.url), 'utf8')
const luminance = (hex: string) => {
  const [r, g, b] = hex.match(/\w\w/g)!.map(v => parseInt(v, 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
  return .2126 * r + .7152 * g + .0722 * b
}

test('light chart colors are brighter than the previous palette without becoming pale on the base surface', () => {
  for (const [series, before] of Object.entries({ pressure: '117449', flow: '216c9b', temperature: 'ad3f48', weight: '845331' })) {
    const tokens = [...css.matchAll(new RegExp(`--chart-${series}:#([a-f0-9]{6})`, 'g'))]
    assert.equal(tokens.length, 1, `${series} must be shared, not overridden on profile cards`)
    const after = luminance(tokens[0][1])
    assert.ok(after > luminance(before), series)
    assert.ok((luminance('f0ede6') + .05) / (after + .05) >= 3, `${series} base-surface contrast`)
  }
  assert.match(css, /\.settings-line-options path \{stroke:var\(--chart-pressure\)\}/)
})
