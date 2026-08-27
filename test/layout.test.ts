import assert from 'node:assert/strict'
import test from 'node:test'
import { formatViewportDiagnostics, isCompactLandscapeViewport } from '../src/domain/layout.ts'

test('uses compact landscape layout for A7-class CSS viewports', () => {
  assert.equal(isCompactLandscapeViewport(1007, 602), true)
  assert.equal(isCompactLandscapeViewport(962, 602), true)
})

test('keeps taller iPad viewports on the standard layout', () => {
  assert.equal(isCompactLandscapeViewport(1024, 768), false)
  assert.equal(isCompactLandscapeViewport(1194, 834), false)
})

test('reports dimensions and density for tester screenshots', () => {
  assert.equal(formatViewportDiagnostics(1007, 602, 1.33), '1007×602 · compact · DPR 1.33 · visual 1007×602')
})
