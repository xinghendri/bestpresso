import assert from 'node:assert/strict'
import test from 'node:test'
import { horizontalChartGridLines } from '../src/features/brew/chartGrid.ts'

test('horizontal graph guides span the complete plot width', () => {
  assert.deepEqual(horizontalChartGridLines({ left: 42, right: 978, top: 38, bottom: 340 }, 5), [
    { ratio: 0, x1: 42, x2: 978, y: 38 },
    { ratio: 0.25, x1: 42, x2: 978, y: 113.5 },
    { ratio: 0.5, x1: 42, x2: 978, y: 189 },
    { ratio: 0.75, x1: 42, x2: 978, y: 264.5 },
    { ratio: 1, x1: 42, x2: 978, y: 340 },
  ])
})
