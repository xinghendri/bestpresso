import assert from 'node:assert/strict'
import test from 'node:test'
import { liveShotFlowRate } from '../src/domain/brewing.ts'

test('uses the latest finite gravimetric flow reading', () => {
  assert.equal(liveShotFlowRate([{ weightFlow: 0.8 }, { weightFlow: 1.7 }]), 1.7)
})

test('holds the latest valid reading across a missing frame', () => {
  assert.equal(liveShotFlowRate([{ weightFlow: 1.4 }, {}]), 1.4)
})

test('shows a falling flow as zero and ignores unusable readings', () => {
  assert.equal(liveShotFlowRate([{ weightFlow: -0.2 }]), 0)
  assert.equal(liveShotFlowRate([{ weightFlow: Number.NaN }]), undefined)
})
