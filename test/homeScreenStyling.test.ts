import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const utilityCard = readFileSync(new URL('../src/features/machine/MachineUtilityCard.tsx', import.meta.url), 'utf8')
const brewingPanel = readFileSync(new URL('../src/features/brew/BrewingPanel.tsx', import.meta.url), 'utf8')
const liveScreen = readFileSync(new URL('../src/features/brew/LiveBrewingScreen.tsx', import.meta.url), 'utf8')
const historyScreen = readFileSync(new URL('../src/features/history/PreviousShotScreen.tsx', import.meta.url), 'utf8')
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

test('defines reusable large, medium, and small metric typography', () => {
  assert.match(styles, /--metric-label-color:#878787;/)
  assert.match(styles, /--metric-value-color:#f5f5f5;/)
  assert.match(styles, /--metric-label-size-large:14px; --metric-label-size-medium:14px; --metric-label-size-small:12px;/)
  assert.match(styles, /--metric-value-size-large:32px; --metric-value-size-medium:24px; --metric-value-size-small:17px;/)
  assert.match(styles, /\.metric-scale--large,\.metric--large \{ --metric-context-label-size:var\(--metric-label-size-large\);/)
  assert.match(styles, /\.metric-scale--medium,\.metric--medium \{ --metric-context-label-size:var\(--metric-label-size-medium\);/)
  assert.match(styles, /\.metric-scale--small,\.metric--small \{ --metric-context-label-size:var\(--metric-label-size-small\);/)
  assert.match(utilityCard, /size=\{isScale \|\| !compact \? 'large' : 'small'\}/)
})

test('reflows the collapsed scale name and anchors its weight to the card bottom', () => {
  assert.match(styles, /\.utility-card--scale\.utility-card--compact header \{[^}]*grid-template-columns:25px minmax\(0,1fr\);/)
  assert.match(styles, /\.utility-card--scale\.utility-card--compact header>span \{[^}]*width:auto;[^}]*transform:none;[^}]*-webkit-line-clamp:2;/)
  assert.match(styles, /\.utility-card--scale\.utility-card--compact \.utility-card__metrics \{[^}]*top:auto; bottom:18px; width:auto;/)
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

test('makes the needs-water state visibly red in the header and reservoir', () => {
  assert.match(styles, /\.status-pill--thirsty \{ border-color:#de6161; color:#f49090;/)
  assert.match(styles, /\.status-pill--thirsty img \{[^}]*filter:/)
  assert.match(styles, /\.reservoir-meter--needs-water \{ background:rgba\(91,54,54,\.64\); \}/)
  assert.match(styles, /\.reservoir-meter--needs-water \.reservoir-meter__icon img \{ filter:/)
})

test('uses the large permutation for standard home-screen metric readings', () => {
  assert.match(styles, /\.metric__reading \{ color:var\(--metric-value-color\); font-size:var\(--metric-context-value-size,var\(--metric-value-size-large\)\);/)
  assert.match(styles, /\.brew-metrics \.metric__reading,[^\n]*font-size:var\(--metric-value-size-large\)/)
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

test('uses a lighter two-pixel line only for the home history chart', () => {
  assert.match(styles, /\.history-card \.mini-chart \.chart-line \{ stroke-width:2; \}/)
})

test('uses stable header metric slots with symmetric separator spacing', () => {
  assert.match(styles, /\.live-pull-header__metrics \{ --header-metric-separator-gap:24px; width:max-content; max-width:100%;[^}]*grid-template-columns:108px 1px 280px;[^}]*gap:var\(--header-metric-separator-gap\);/)
  assert.match(styles, /\.history-browser-detail \.live-pull-header__metrics strong\{color:var\(--metric-value-color\);font-size:var\(--metric-value-size-medium\)\}/)
  assert.doesNotMatch(styles, /\.history-browser-detail \.live-pull-header__metrics \{ width:312px;/)
  assert.match(styles, /@media\(max-width:600px\)[\s\S]*\.live-pull-header__metrics\{--header-metric-separator-gap:12px;grid-template-columns:68px 1px 120px\}/)
})

test('adds a separated live flow-rate slot without changing history metrics', () => {
  assert.match(historyScreen, /isCleaning \? ' live-pull-header__metrics--single' : ' live-pull-header__metrics--history'/)
  assert.match(styles, /\.live-pull-header__metrics--live \{ --header-metric-separator-gap:18px; grid-template-columns:118px 1px 196px 1px 118px; \}/)
  assert.match(styles, /\.live-pull-header__metrics--history \{ grid-template-columns:108px 1px 108px; \}/)
  assert.match(liveScreen, /live-pull-header__metrics metric-scale--medium/)
  assert.match(historyScreen, /live-pull-header__metrics metric-scale--medium/)
  assert.match(styles, /\.live-pull-header__metrics strong,[^\n]*font-size:var\(--metric-value-size-medium\)/)
  assert.match(styles, /\.live-pull-header__metrics strong small,[^\n]*font-size:var\(--metric-unit-size-medium\)/)
  assert.match(styles, /@media\(max-width:760px\)[\s\S]*\.live-pull-header__metrics--live\{--header-metric-separator-gap:12px;grid-template-columns:84px 1px 160px 1px 84px\}/)
  assert.match(styles, /@media\(max-width:600px\)[\s\S]*\.live-pull-header__metrics--live\{grid-template-columns:68px 1px 120px 1px 80px\}/)
  assert.match(styles, /@media\(max-width:600px\)[\s\S]*\.live-pull-header__metrics--history\{grid-template-columns:68px 1px 80px\}/)
})

test('keeps shot metrics and actions in a compact content-sized group', () => {
  assert.match(liveScreen, /className="live-pull-header__controls"/)
  assert.match(historyScreen, /className="live-pull-header__controls"/)
  assert.match(styles, /\.live-pull-header \{[^}]*grid-template-columns:minmax\(0,1fr\) max-content;/)
  assert.match(styles, /\.live-pull-header__controls \{[^}]*display:flex;[^}]*gap:clamp\(10px,1\.2vw,16px\);/)
  assert.match(styles, /\.live-pull-header__actions \{[^}]*display:flex;[^}]*gap:10px;/)
  assert.doesNotMatch(styles, /\.live-pull-header \{[^}]*grid-template-columns:minmax\(0,1fr\) auto 118px;/)
})

test('constrains the live title and chart to one fixed-width grid track', () => {
  assert.match(styles, /\.live-brew-screen \{[^}]*grid-template-columns:minmax\(0,1fr\);[^}]*overflow:hidden;[^}]*contain:layout;/)
  assert.match(styles, /\.live-pull-header \{ width:100%; max-width:100%; min-width:0;/)
  assert.match(styles, /\.live-pull-chart-panel \{ width:100%; max-width:100%; min-width:0;[^}]*overflow:hidden; contain:layout paint;/)
  assert.match(styles, /\.live-shot-chart \{[^}]*width:100%; max-width:100%;[^}]*min-width:0;[^}]*overflow:hidden;/)
  assert.match(styles, /\.live-shot-chart svg \{[^}]*width:100%; max-width:100%;/)
})
