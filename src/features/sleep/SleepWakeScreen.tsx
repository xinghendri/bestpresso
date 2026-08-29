import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type TouchEvent as ReactTouchEvent } from 'react'
import logo from '../../assets/figma/decent-logo.png'
import { formatDeviceTime } from './deviceTime'
import { WAKE_HOLD_DURATION_MS, WakeHoldGesture, type WakeHoldUpdate } from './wakeHoldGesture'

interface SleepWakeScreenProps {
  onWake: () => void
}

interface PulsePoint {
  pointerId: number
  x: number
  y: number
}

export function SleepWakeScreen({ onWake }: SleepWakeScreenProps) {
  const gesture = useRef(new WakeHoldGesture())
  const holdTimer = useRef<number | null>(null)
  const [pulse, setPulse] = useState<PulsePoint | null>(null)
  const [now, setNow] = useState(() => new Date())

  const cancelHold = () => {
    if (holdTimer.current !== null) window.clearTimeout(holdTimer.current)
    holdTimer.current = null
    setPulse(null)
  }

  const applyUpdate = (update: WakeHoldUpdate) => {
    if (update.kind === 'cancel') {
      cancelHold()
      return
    }
    if (update.kind !== 'start') return

    cancelHold()
    setPulse({ pointerId: update.pointerId, x: update.x, y: update.y })
    holdTimer.current = window.setTimeout(() => {
      holdTimer.current = null
      if (!gesture.current.complete(update.pointerId)) {
        setPulse(null)
        return
      }
      onWake()
    }, WAKE_HOLD_DURATION_MS)
  }

  useEffect(() => {
    const clockTimer = window.setInterval(() => setNow(new Date()), 30_000)
    return () => {
      window.clearInterval(clockTimer)
      if (holdTimer.current !== null) window.clearTimeout(holdTimer.current)
    }
  }, [])

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    applyUpdate(gesture.current.pointerDown(event.pointerId, event.clientX, event.clientY))
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType !== 'mouse') return
    applyUpdate(gesture.current.pointerMove(event.pointerId, event.clientX, event.clientY))
  }

  const handlePointerEnd = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType !== 'mouse') return
    applyUpdate(gesture.current.pointerEnd(event.pointerId))
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const handleTouchStart = (event: ReactTouchEvent<HTMLButtonElement>) => {
    event.preventDefault()
    Array.from(event.changedTouches).forEach((touch) => {
      applyUpdate(gesture.current.pointerDown(touch.identifier, touch.clientX, touch.clientY))
    })
  }

  const handleTouchMove = (event: ReactTouchEvent<HTMLButtonElement>) => {
    event.preventDefault()
    Array.from(event.touches).forEach((touch) => {
      applyUpdate(gesture.current.pointerMove(touch.identifier, touch.clientX, touch.clientY))
    })
  }

  const handleTouchEnd = (event: ReactTouchEvent<HTMLButtonElement>) => {
    event.preventDefault()
    Array.from(event.changedTouches).forEach((touch) => {
      applyUpdate(gesture.current.pointerEnd(touch.identifier))
    })
  }

  return <button
    className="sleep-screen"
    type="button"
    aria-label="Hold with one finger for 1 second to wake machine"
    onContextMenu={(event) => event.preventDefault()}
    onPointerDown={handlePointerDown}
    onPointerMove={handlePointerMove}
    onPointerUp={handlePointerEnd}
    onPointerCancel={handlePointerEnd}
    onTouchStart={handleTouchStart}
    onTouchMove={handleTouchMove}
    onTouchEnd={handleTouchEnd}
    onTouchCancel={handleTouchEnd}
  >
    <span className="sleep-screen__identity" aria-hidden="true">
      <img src={logo} alt="" />
      <span className="sleep-screen__time">{formatDeviceTime(now)}</span>
    </span>
    <span className="sleep-screen__hint">Touch and hold to wake</span>
    {pulse && <span className="sleep-screen__pulse" style={{ left: pulse.x, top: pulse.y }} aria-hidden="true" />}
  </button>
}
