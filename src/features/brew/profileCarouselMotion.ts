export function wrappedProfileOffset(index: number, centerIndex: number, length: number) {
  if (length <= 0) return 0
  let offset = index - centerIndex
  while (offset > length / 2) offset -= length
  while (offset < -length / 2) offset += length
  return offset
}

export function projectedProfileSteps(distance: number, velocity: number, stride: number, length: number) {
  if (length <= 1 || stride <= 0) return 0
  const momentum = Math.max(-stride, Math.min(stride, velocity * 180))
  const projectedDistance = distance + momentum
  let steps = Math.round(-projectedDistance / stride)
  if (steps === 0 && Math.abs(distance) >= 42) steps = distance < 0 ? 1 : -1
  const maximum = length - 1
  return Math.max(-maximum, Math.min(maximum, steps))
}

export function profileCardMotion(offset: number) {
  const distance = Math.abs(offset)
  const direction = Math.sign(offset)
  const position = distance <= 1
    ? distance * 21.5
    : distance <= 2
      ? 21.5 + (distance - 1) * 13
      : 34.5 + (distance - 2) * 10
  const scale = distance <= 1
    ? 1 - distance * 0.25
    : distance <= 2
      ? 0.75 - (distance - 1) * 0.16
      : Math.max(0.48, 0.59 - (distance - 2) * 0.09)
  return {
    xPercent: direction * position,
    scale,
    opacity: distance <= 2 ? 1 : Math.max(0, 1 - (distance - 2) * 0.9),
    zIndex: Math.max(0, 10 - Math.round(distance * 3)),
  }
}
