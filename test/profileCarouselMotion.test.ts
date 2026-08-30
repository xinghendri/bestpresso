import assert from 'node:assert/strict'
import test from 'node:test'
import { profileCardMotion, profileCardPosition, projectedProfileSteps, wrappedProfileOffset } from '../src/features/brew/profileCarouselMotion.ts'

test('a long swipe can traverse several profiles', () => {
  assert.equal(projectedProfileSteps(-290, 0, 120, 6), 2)
  assert.equal(projectedProfileSteps(370, 0, 120, 6), -3)
})

test('a quick flick projects beyond its raw drag distance', () => {
  assert.equal(projectedProfileSteps(-100, -0.8, 120, 6), 2)
  assert.equal(projectedProfileSteps(-55, 0, 120, 6), 1)
  assert.equal(projectedProfileSteps(-290, -20, 120, 6), 3)
})

test('profile offsets and motion remain continuous around the carousel', () => {
  assert.equal(wrappedProfileOffset(5, 0, 6), -1)
  assert.equal(wrappedProfileOffset(0, 5, 6), 1)
  assert.deepEqual(profileCardMotion(0), { xPercent: 0, scale: 1, opacity: 1, zIndex: 10 })
  assert.equal(profileCardMotion(1).scale, 0.75)
  assert.equal(profileCardMotion(2).scale, 0.59)
})

test('only five profile slots remain visible with an ad hoc sixth card', () => {
  for (const center of [0, .25, .5, .75, 1]) {
    const positions = Array.from({ length: 6 }, (_, index) => profileCardPosition(wrappedProfileOffset(index, center, 6)))
    assert.equal(positions.filter((position) => position !== 'hidden').length, 5)
  }
})
