import { useEffect } from 'react'
import { primeCompletionSound } from '../../audio/completionSound'

type AudioContextConstructor = typeof AudioContext

const audioContextConstructor = () => window.AudioContext ?? (window as typeof window & { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext

export function InteractionSound() {
  useEffect(() => {
    let context: AudioContext | null = null

    const playTap = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest('button:not(:disabled), a[href], [role="button"]:not([aria-disabled="true"])') : null
      if (!target) return

      const AudioContextClass = audioContextConstructor()
      if (!AudioContextClass) return

      try {
        context ??= new AudioContextClass()
        if (context.state === 'suspended') void context.resume().catch(() => undefined)

        const oscillator = context.createOscillator()
        const gain = context.createGain()
        const startedAt = context.currentTime
        oscillator.type = 'sine'
        oscillator.frequency.setValueAtTime(520, startedAt)
        oscillator.frequency.exponentialRampToValueAtTime(360, startedAt + 0.022)
        gain.gain.setValueAtTime(0.0001, startedAt)
        gain.gain.exponentialRampToValueAtTime(0.018, startedAt + 0.002)
        gain.gain.exponentialRampToValueAtTime(0.0001, startedAt + 0.026)
        oscillator.connect(gain)
        gain.connect(context.destination)
        oscillator.addEventListener('ended', () => {
          oscillator.disconnect()
          gain.disconnect()
        }, { once: true })
        oscillator.start(startedAt)
        oscillator.stop(startedAt + 0.03)
      } catch {
        // Sound is progressive enhancement; interactions remain functional without it.
      }
    }

    document.addEventListener('pointerdown', primeCompletionSound, { capture: true, passive: true })
    document.addEventListener('click', playTap, true)
    return () => {
      document.removeEventListener('pointerdown', primeCompletionSound, true)
      document.removeEventListener('click', playTap, true)
      if (context?.state !== 'closed') void context?.close().catch(() => undefined)
    }
  }, [])

  return null
}
