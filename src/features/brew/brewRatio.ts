export function doseToYieldRatio(dose: string | number, targetYield: string | number) {
  const doseValue = Number(dose)
  const yieldValue = Number(targetYield)
  if (!Number.isFinite(doseValue) || doseValue <= 0 || !Number.isFinite(yieldValue)) return undefined

  const roundedRatio = Math.round((yieldValue / doseValue) * 10) / 10
  const displayRatio = Number.isInteger(roundedRatio) ? String(roundedRatio) : roundedRatio.toFixed(1)
  return `1:${displayRatio} ratio`
}
