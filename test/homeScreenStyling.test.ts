import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const utilityCard = readFileSync(new URL('../src/features/machine/MachineUtilityCard.tsx', import.meta.url), 'utf8')
const styles = readFileSync(new URL('../src/styles/index.css', import.meta.url), 'utf8')
const utilityIcons = ['hot-water.svg', 'steam.svg', 'scale.svg'].map((name) => readFileSync(new URL(`../src/assets/figma/${name}`, import.meta.url), 'utf8'))

test('marks disabled steam heating so its temperature is no longer shown as a warning', () => {
  assert.match(utilityCard, /isSteam && !steamHeatingEnabled \? ' utility-card--steam-off'/)
  assert.match(styles, /\.utility-card--steam\.utility-card--steam-off \.metric:first-child \.metric__reading \{ color:#707070; \}/)
})

test('uses regular weight for home-screen labels without changing action typography', () => {
  assert.match(styles, /\.app-shell \.utility-card header,\.app-shell \.metric__label,\.app-shell \.history-card__summary small \{ font-weight:400; \}/)
})

test('uses weight 100 for home-screen numeric readouts in every card state', () => {
  assert.match(styles, /\.app-shell \.metric__reading,[\s\S]*\.app-shell \.status-pill--heating span,[\s\S]*\.app-shell \.utility-card--compact:not\(\.utility-card--scale\) \.metric__reading \{\s*font-weight:100;/)
})

test('increases collapsed home-screen numeric readouts by one pixel', () => {
  assert.match(styles, /\.utility-card--compact:not\(\.utility-card--scale\) \.metric__reading \{ font-size:17px;/)
  assert.match(styles, /\.utility-card--compact:not\(\.utility-card--scale\) \.metric__reading small \{[^}]*font-size:13px;/)
  assert.match(styles, /\.utility-card--scale\.utility-card--compact \.metric__reading \{ font-size:33px;/)
  assert.match(styles, /\.utility-card--scale\.utility-card--compact \.metric__reading small \{[^}]*font-size:23px;/)
})

test('uses the requested home-screen colors for labels and numbers', () => {
  assert.match(styles, /\.app-shell \.utility-card header,[\s\S]*\.app-shell \.history-card__summary time \{\s*color:#707070;/)
  assert.match(styles, /\.app-shell \.metric__reading,[\s\S]*\.app-shell \.status-pill--heating span \{\s*color:#f5f5f5;/)
})

test('preserves contrast and semantic steam colors on the home screen', () => {
  assert.match(styles, /\.app-shell \.metric__subtext--pill \{\s*color:#202020;/)
  assert.match(styles, /\.app-shell \.utility-card--steam \.metric:first-child \.metric__reading--highlight \{\s*color:#e5d55e;/)
  assert.match(styles, /\.app-shell \.utility-card--steam\.utility-card--steam-off \.metric:first-child \.metric__reading \{\s*color:#707070;/)
})

test('keeps utility titles and icons near-white while secondary grey uses 707070', () => {
  assert.doesNotMatch(styles, /#a5a5a5/)
  assert.match(styles, /\.app-shell \.utility-card--water header,[\s\S]*\.app-shell \.utility-card--scale header \{\s*color:#f5f5f5;/)
  utilityIcons.forEach((icon) => {
    assert.match(icon, /fill="#F5F5F5"/)
    assert.doesNotMatch(icon, /#E3E3E3/)
  })
})

test('uses the smaller proportional steam toggle', () => {
  assert.match(styles, /\.steam-heating-toggle \{[^}]*width:48px; height:22px;/)
  assert.match(styles, /\.steam-heating-toggle>span \{[^}]*width:25px; height:18px;/)
  assert.match(styles, /\.steam-heating-toggle--enabled>span \{[^}]*transform:translateX\(19px\);/)
})

test('uses 32px standard home-screen metric readings', () => {
  assert.match(styles, /\.metric__reading \{ color:#707070; font-size:32px;/)
  assert.match(styles, /\.brew-metrics \.metric__reading \{ font-size:32px; \}/)
})
