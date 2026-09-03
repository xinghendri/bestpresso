const PRESSURE_READING_WIDTH_CH = 3.75
const PRESSURE_SEPARATOR_WIDTH_CH = 2.3

export function pressureChainSlotCount(pressures: number[], reversalThreshold: number) {
  if (pressures.length <= 1) return 1

  let slots = 2
  let direction = 0
  let extreme = pressures[0]

  for (const pressure of pressures.slice(1)) {
    const fromExtreme = pressure - extreme
    if (direction === 0) {
      const fromStart = pressure - pressures[0]
      if (Math.abs(fromStart) >= reversalThreshold) direction = Math.sign(fromStart)
      extreme = pressure
      continue
    }

    if (fromExtreme * direction >= 0) {
      extreme = pressure
      continue
    }

    if (Math.abs(fromExtreme) >= reversalThreshold) {
      slots += 1
      direction = Math.sign(fromExtreme)
      extreme = pressure
    }
  }

  return slots
}

export function pressureChainMinimumWidth(slotCount: number) {
  const count = Math.max(1, slotCount)
  return `${count * PRESSURE_READING_WIDTH_CH + (count - 1) * PRESSURE_SEPARATOR_WIDTH_CH}ch`
}
