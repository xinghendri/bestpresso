export const WAKE_HOLD_DURATION_MS = 1_000
export const WAKE_HOLD_MOVEMENT_TOLERANCE_PX = 20

export type WakeHoldUpdate =
  | { kind: 'start'; pointerId: number; x: number; y: number }
  | { kind: 'cancel' }
  | { kind: 'tap' }
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

  // The browser's `touches` list is the truth about which fingers are down. A finger
  // whose touch-up never reached the page (a palm brush, a second finger, the app
  // backgrounded mid-touch) otherwise stays counted for as long as the sleep screen is
  // mounted, which can be hours, and every later hold is refused as multi-touch.
  syncActivePointers(pointerIds: Iterable<number>): void {
    const current = new Set(pointerIds)
    for (const id of this.activePointers) if (!current.has(id)) this.activePointers.delete(id)
    if (this.candidate && !current.has(this.candidate.pointerId)) this.candidate = null
    if (this.activePointers.size === 0) this.blocked = false
  }

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

  pointerEnd(pointerId: number, allowTap = false): WakeHoldUpdate {
    this.activePointers.delete(pointerId)
    const endedCandidate = this.candidate?.pointerId === pointerId
    if (endedCandidate) this.candidate = null
    if (this.activePointers.size === 0) this.blocked = false
    return endedCandidate ? { kind: allowTap ? 'tap' : 'cancel' } : { kind: 'none' }
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
