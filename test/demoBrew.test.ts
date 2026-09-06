import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import type { BrewProfile, LiveShotPoint } from '../src/domain/brewing.ts'
import { DEMO_PROFILE_LONG_PRESS_MS, demoBrewForProfile, demoBrewPointsAtElapsed } from '../src/features/brew/demoBrew.ts'

const profile: BrewProfile = {
  id: 'test-profile',
  name: 'Test / Long-hold profile',
  temperature: '94',
  grindSetting: '20',
  dose: '18',
  targetYield: '48',
}

test('demo pull uses the selected profile metadata and scales its fixture telemetry', () => {
  const demo = demoBrewForProfile(profile)
  assert.equal(demo.profileName, profile.name)
  assert.equal(demo.targetYield, 48)
  assert.equal(demo.durationMs, 48_000)
  assert.equal(demo.points[0].temperature, 90)
  assert.ok(Math.abs((demo.points.at(-1)?.weight ?? 0) - 48) < 0.001)
})

test('demo pull interpolates an in-progress point instead of jumping between samples', () => {
  const points: LiveShotPoint[] = [
    { elapsedMs: 0, stageIndex: 0, stageName: 'Fill', pressure: 0, flow: 4, weight: 0 },
    { elapsedMs: 1000, stageIndex: 1, stageName: 'Pour', pressure: 8, flow: 2, weight: 10 },
  ]
  const visible = demoBrewPointsAtElapsed(points, 500)
  assert.equal(visible.length, 2)
  assert.deepEqual(visible.at(-1), { elapsedMs: 500, stageIndex: 0, stageName: 'Fill', pressure: 4, flow: 3, weight: 5 })
})

test('demo pull clamps telemetry to its available time range', () => {
  const points: LiveShotPoint[] = [{ elapsedMs: 0, pressure: 0 }, { elapsedMs: 1000, pressure: 8 }]
  assert.equal(demoBrewPointsAtElapsed(points, -100).at(-1)?.elapsedMs, 0)
  assert.equal(demoBrewPointsAtElapsed(points, 2000).at(-1)?.elapsedMs, 1000)
})

test('long-hold gesture is fixture-only and cancels when the carousel becomes a swipe', () => {
  const panelSource = readFileSync(new URL('../src/features/brew/BrewingPanel.tsx', import.meta.url), 'utf8')
  const shellSource = readFileSync(new URL('../src/app/AppShell.tsx', import.meta.url), 'utf8')
  const hookSource = readFileSync(new URL('../src/features/brew/useBrewingData.ts', import.meta.url), 'utf8')
  assert.equal(DEMO_PROFILE_LONG_PRESS_MS, 700)
  assert.match(panelSource, /Math\.abs\(distance\) >= 8[\s\S]*cancelDemoHold\(\)/)
  assert.match(shellSource, /demoMode=\{connection === 'fixture'\}/)
  assert.match(hookSource, /if \(connection !== 'fixture' \|\| demoBrewSession\.current \|\| liveBrew\.active\) return/)
})
