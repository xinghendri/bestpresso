import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const profileChart = readFileSync(new URL('../src/features/brew/ProfileTargetChart.tsx', import.meta.url), 'utf8')
const historyChart = readFileSync(new URL('../src/features/history/MiniShotChart.tsx', import.meta.url), 'utf8')

test('profile target charts cache the real pressure, flow, and temperature paths', () => {
  assert.match(profileChart, /useMemo\(\(\) => targetPath\(points, 'pressure', 0, 12/)
  assert.match(profileChart, /useMemo\(\(\) => targetPath\(points, 'flow', 0, 12/)
  assert.match(profileChart, /useMemo\(\(\) => targetPath\(points, 'temperature', 20, 110/)
  assert.match(profileChart, /variant === 'detail'.*temperaturePath/)
  assert.match(profileChart, /export const ProfileTargetChart = memo\(ProfileTargetChartComponent\)/)
})

test('history thumbnails cache smoothing and static chart paths', () => {
  assert.match(historyChart, /useMemo\(\(\) => smoothShotTelemetry\(points\)/)
  assert.match(historyChart, /useMemo\(\(\) => snapshotPath\(displayPoints, 'pressure'/)
  assert.match(historyChart, /useMemo\(\(\) => snapshotPath\(displayPoints, 'flow'/)
  assert.match(historyChart, /useMemo\(\(\) => snapshotPath\(points, 'weight'/)
  assert.match(historyChart, /export const MiniShotChart = memo\(MiniShotChartComponent\)/)
})
