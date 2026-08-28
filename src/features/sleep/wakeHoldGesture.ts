export const WAKE_HOLD_DURATION_MS = 1_000
export const WAKE_HOLD_MOVEMENT_TOLERANCE_PX = 20

export type WakeHoldUpdate =
  | { kind: 'start'; pointerId: number; x: number; y: number }
  | { kind: 'cancel' }
  | { kind: 'none' }

interface WakeHoldCandidate {
  pointerId: number
  startX: number
  startY: number
}

export class WakeHoldGesture {
  private readonly activePointers = new Set<number>()
  private candidate: WakeHoldCandidate | null = null
  private blocked = false

  pointerDown(pointerId: number, x: number, y: number): WakeHoldUpdate {
    this.activePointers.add(pointerId)
    if (this.blocked || this.activePointers.size !== 1 || this.candidate) {
      this.blocked = true
      this.candidate = null
      return { kind: 'cancel' }
    }

    this.candidate = { pointerId, startX: x, startY: y }
    return { kind: 'start', pointerId, x, y }
  }

  pointerMove(pointerId: number, x: number, y: number): WakeHoldUpdate {
    if (!this.candidate || this.candidate.pointerId !== pointerId) return { kind: 'none' }
    if (Math.hypot(x - this.candidate.startX, y - this.candidate.startY) <= WAKE_HOLD_MOVEMENT_TOLERANCE_PX) {
      return { kind: 'none' }
    }

    this.blocked = true
    this.candidate = null
    return { kind: 'cancel' }
  }

  pointerEnd(pointerId: number): WakeHoldUpdate {
    this.activePointers.delete(pointerId)
    const endedCandidate = this.candidate?.pointerId === pointerId
    if (endedCandidate) this.candidate = null
    if (this.activePointers.size === 0) this.blocked = false
    return endedCandidate ? { kind: 'cancel' } : { kind: 'none' }
  }

  complete(pointerId: number) {
    const accepted = !this.blocked && this.activePointers.size === 1 && this.candidate?.pointerId === pointerId
    if (accepted) {
      this.blocked = true
      this.candidate = null
    }
    return accepted
  }
}
