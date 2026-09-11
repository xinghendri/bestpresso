export type TemperatureUnit = 'C' | 'F'

export const celsiusToFahrenheit = (celsius: number) => celsius * 9 / 5 + 32

export const fahrenheitToCelsius = (fahrenheit: number) => (fahrenheit - 32) * 5 / 9

export const temperatureUnitLabel = (_unit: TemperatureUnit) => '°'

export const temperatureToDisplay = (celsius: number, unit: TemperatureUnit) => (
  unit === 'F' ? celsiusToFahrenheit(celsius) : celsius
)

export const temperatureFromDisplay = (value: number, unit: TemperatureUnit) => {
  const celsius = unit === 'F' ? fahrenheitToCelsius(value) : value
  return Math.round(celsius * 10) / 10
}

export const temperatureStepToDisplay = (celsiusStep: number, unit: TemperatureUnit) => (
  unit === 'F' ? Math.max(1, Math.round(celsiusStep * 9 / 5)) : celsiusStep
)

export const temperatureBoundToDisplay = (celsius: number, unit: TemperatureUnit) => (
  Math.round(temperatureToDisplay(celsius, unit))
)

export const formatTemperatureValue = (
  celsius: number | string | undefined,
  unit: TemperatureUnit,
  digits = 0,
) => {
  const value = Number(celsius)
  if (!Number.isFinite(value)) return '—'
  return temperatureToDisplay(value, unit).toFixed(digits)
}
