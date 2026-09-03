import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const utilityCard = readFileSync(new URL('../src/features/machine/MachineUtilityCard.tsx', import.meta.url), 'utf8')
const brewingPanel = readFileSync(new URL('../src/features/brew/BrewingPanel.tsx', import.meta.url), 'utf8')
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
  assert.match(styles, /\.app-shell \.metric__label \{\s*color:#878787;/)
  assert.match(styles, /\.app-shell \.metric__reading,[\s\S]*\.app-shell \.status-pill--heating span \{\s*color:#f5f5f5;/)
})

test('preserves contrast and semantic steam colors on the home screen', () => {
  assert.match(styles, /\.app-shell \.metric__subtext--pill \{\s*color:#c8c8c8;\s*background:#3a3a3a;/)
  assert.match(styles, /\.app-shell \.utility-card--steam \.metric:first-child \.metric__reading--highlight \{\s*color:#e5d55e;/)
  assert.match(styles, /\.app-shell \.utility-card--steam\.utility-card--steam-off \.metric:first-child \.metric__reading \{\s*color:#707070;/)
})

test('keeps profile metrics in four stable columns while profile values change', () => {
  assert.match(styles, /\.brew-panel \{ --brew-panel-inline-padding:24px; --brew-metrics-inline-adjustment:2\.4px;/)
  assert.match(styles, /\.brew-metrics \{ width:calc\(100% \+ var\(--brew-panel-inline-padding\) \+ var\(--brew-panel-inline-padding\)\); display:grid; grid-template-columns:repeat\(4,minmax\(0,1fr\)\);/)
  assert.match(styles, /\.brew-metrics \{[^}]*margin-inline:calc\(0px - var\(--brew-panel-inline-padding\)\); padding:0 calc\(5% \+ var\(--brew-metrics-inline-adjustment\)\);/)
  assert.match(styles, /\.brew-metrics \.metric \{[^}]*width:100%;[^}]*text-align:center;/)
  assert.match(styles, /\.brew-metrics \.metric__label \{ position:absolute; left:50%; top:0; transform:translateX\(-50%\); \}/)
  assert.doesNotMatch(styles, /\.brew-metrics \.metric:(?:first-child|nth-child\(4\))/)
  assert.doesNotMatch(styles, /@keyframes metrics-in/)
  assert.doesNotMatch(brewingPanel, /className="brew-metrics" key=/)
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

test('lets the home history summary hug its content while preserving a contractible chart', () => {
  assert.match(styles, /\.history-card \{ --history-chart-min-width:180px;[^}]*grid-template-columns:minmax\(0,max-content\) minmax\(var\(--history-chart-min-width\),1fr\);/)
  assert.match(styles, /\.history-card__summary>div \{ width:max-content; max-width:100%;/)
  assert.match(styles, /@media\(max-width:760px\)[\s\S]*\.history-card\{--history-chart-min-width:120px;/)
  assert.match(styles, /@media\(min-width:761px\) and \(max-height:680px\)[\s\S]*\.history-card\{--history-chart-min-width:140px;/)
})

test('uses three-pixel data lines and matching legend samples across graphs', () => {
  assert.match(styles, /\.profile-target-line,[\s\S]*\.profile-detail-chart \.profile-target-line \{\s*stroke-width:3;/)
  assert.match(styles, /\.chart-legend__sample \{ height:3px;/)
})
