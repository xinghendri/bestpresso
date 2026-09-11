import assert from 'node:assert/strict'
import test from 'node:test'
import { celsiusToFahrenheit, fahrenheitToCelsius, formatTemperatureValue, temperatureBoundToDisplay, temperatureFromDisplay, temperatureUnitLabel } from '../src/domain/temperature.ts'

test('keeps Decaid values canonical in Celsius', () => {
  assert.ok(Math.abs(celsiusToFahrenheit(93) - 199.4) < 0.0001)
  assert.ok(Math.abs(fahrenheitToCelsius(199.4) - 93) < 0.0001)
  assert.equal(temperatureFromDisplay(199.4, 'F'), 93)
})

test('formats live values in the selected display unit', () => {
  assert.equal(formatTemperatureValue(92.5, 'C', 1), '92.5')
  assert.equal(formatTemperatureValue(92.5, 'F', 1), '198.5')
  assert.equal(formatTemperatureValue(undefined, 'F'), '—')
})

test('uses only an attached degree symbol for displayed temperatures', () => {
  assert.equal(temperatureUnitLabel('C'), '°')
  assert.equal(temperatureUnitLabel('F'), '°')
})

test('uses whole display bounds for controls', () => {
  assert.equal(temperatureBoundToDisplay(35, 'F'), 95)
  assert.equal(temperatureBoundToDisplay(95, 'F'), 203)
})
