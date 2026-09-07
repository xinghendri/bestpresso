import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const profileChart = readFileSync(new URL('../src/features/brew/ProfileTargetChart.tsx', import.meta.url), 'utf8')
const historyChart = readFileSync(new URL('../src/features/history/MiniShotChart.tsx', import.meta.url), 'utf8')

test('profile target cards cache their static pressure and flow paths', () => {
  assert.match(profileChart, /useMemo\(\(\) => targetPath\(points, 'pressure'/)
  assert.match(profileChart, /useMemo\(\(\) => targetPath\(points, 'flow'/)
  assert.match(profileChart, /export const ProfileTargetChart = memo\(ProfileTargetChartComponent\)/)
})

test('history thumbnails cache smoothing and static chart paths', () => {
  assert.match(historyChart, /useMemo\(\(\) => smoothShotTelemetry\(points\)/)
  assert.match(historyChart, /useMemo\(\(\) => snapshotPath\(displayPoints, 'pressure'/)
  assert.match(historyChart, /useMemo\(\(\) => snapshotPath\(displayPoints, 'flow'/)
  assert.match(historyChart, /useMemo\(\(\) => snapshotPath\(points, 'weight'/)
  assert.match(historyChart, /export const MiniShotChart = memo\(MiniShotChartComponent\)/)
})
