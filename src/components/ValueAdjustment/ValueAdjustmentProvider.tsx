import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent, ReactNode } from 'react'
import logo from '../../assets/figma/decent-logo.png'
import { MAX_VALUE_SUGGESTIONS } from '../../domain/valueAdjustments'
import { ValueAdjustmentContext } from './ValueAdjustmentContext'
import type { ValueAdjustmentMode, ValueAdjustmentRequest } from './ValueAdjustmentContext'

const SUGGESTION_STORAGE_KEY = 'bestpresso.value-adjustment-suggestions.v2'
type SuggestionStore = Partial<Record<ValueAdjustmentRequest['suggestionKey'], number[]>>

const formatValue = (value: number, mode: ValueAdjustmentMode) => mode === 'decimal' ? value.toFixed(1) : String(Math.round(value))
const formatSuggestion = (value: number, mode: ValueAdjustmentMode) => mode === 'decimal' && !Number.isInteger(value) ? value.toFixed(1) : String(value)

const normalizedValue = (value: number, request: ValueAdjustmentRequest) => {
  const steps = Math.round((Math.min(request.max, Math.max(request.min, value)) - request.min) / request.step)
  const stepped = request.min + steps * request.step
  return Number(stepped.toFixed(request.mode === 'decimal' ? 1 : 0))
}

const clampedValue = (value: number, request: ValueAdjustmentRequest) => Math.min(request.max, Math.max(request.min, value))

const normalizedSuggestions = (values: readonly number[], request: ValueAdjustmentRequest) => Array.from(new Set(values
  .filter(Number.isFinite)
  .map((suggestion) => normalizedValue(suggestion, request))))
  .filter((suggestion) => suggestion >= request.min && suggestion <= request.max)
  .slice(-MAX_VALUE_SUGGESTIONS)

const readSuggestionStore = (): SuggestionStore => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SUGGESTION_STORAGE_KEY) ?? '{}')
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return Object.fromEntries(Object.entries(parsed).flatMap(([key, values]) => {
      if (!Array.isArray(values)) return []
      const numericValues = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
      return [[key, numericValues.slice(-MAX_VALUE_SUGGESTIONS)]]
    })) as SuggestionStore
  } catch {
    return {}
  }
}

const writeSuggestionStore = (store: SuggestionStore) => {
  try {
    window.localStorage.setItem(SUGGESTION_STORAGE_KEY, JSON.stringify(store))
  } catch {
    // Suggestion memory is optional when storage is unavailable or full.
  }
}

function ValueAdjustmentScreen({ request, onClose }: { request: ValueAdjustmentRequest; onClose: () => void }) {
  const [value, setValue] = useState(() => normalizedValue(request.value, request))
  const [visualValue, setVisualValue] = useState(value)
  const ruler = useRef<HTMLDivElement>(null)
  const drag = useRef<{ pointerId: number; startX: number; startValue: number } | null>(null)
  const visualValueRef = useRef(value)
  const animationFrame = useRef<number | null>(null)
  const audioContext = useRef<AudioContext | null>(null)
  const lastFeedbackValue = useRef(value)
  const lastFeedbackAt = useRef(0)
  const [suggestionStore, setSuggestionStore] = useState<SuggestionStore>(readSuggestionStore)
  const suggestionStoreRef = useRef(suggestionStore)
  const hasSuggestionHistory = Object.prototype.hasOwnProperty.call(suggestionStore, request.suggestionKey)
  const presets = useMemo(() => normalizedSuggestions(
    hasSuggestionHistory ? suggestionStore[request.suggestionKey] ?? [] : request.presets ?? [],
    request,
  ), [hasSuggestionHistory, request, suggestionStore])
  const valueHint = request.valueHint?.(normalizedValue(visualValue, request))
  const centerLabel = Math.round(visualValue)
  const labels = Array.from({ length: 9 }, (_, index) => centerLabel + index - 4)
  const minorTickStep = request.mode === 'decimal' ? 0.1 : 0.25
  const tickAnchor = Math.floor(visualValue / minorTickStep) * minorTickStep
  const ticks = Array.from({ length: request.mode === 'decimal' ? 101 : 41 }, (_, index) => {
    const offset = index - (request.mode === 'decimal' ? 50 : 20)
    const tickValue = tickAnchor + offset * minorTickStep
    return { left: 50 + (tickValue - visualValue) * 12.5, major: Math.abs(tickValue - Math.round(tickValue)) < 0.001 }
  }).filter((tick) => tick.left >= 0 && tick.left <= 100)

  const stopAnimation = useCallback(() => {
    if (animationFrame.current !== null) cancelAnimationFrame(animationFrame.current)
    animationFrame.current = null
  }, [])

  const prepareAudioFeedback = useCallback(() => {
    if (!audioContext.current && typeof window.AudioContext !== 'undefined') {
      try {
        audioContext.current = new window.AudioContext()
      } catch {
        return
      }
    }

    if (audioContext.current?.state === 'suspended') void audioContext.current.resume().catch(() => undefined)
  }, [])

  const playStepFeedback = useCallback((nextValue: number) => {
    const selectedValue = normalizedValue(nextValue, request)
    if (selectedValue === lastFeedbackValue.current) return
    lastFeedbackValue.current = selectedValue

    const now = performance.now()
    if (now - lastFeedbackAt.current < 32) return
    lastFeedbackAt.current = now

    const context = audioContext.current
    if (!context || context.state !== 'running') return

    try {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      const startedAt = context.currentTime
      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(request.mode === 'integer' ? 460 : 560, startedAt)
      gain.gain.setValueAtTime(0.0001, startedAt)
      gain.gain.exponentialRampToValueAtTime(0.014, startedAt + 0.003)
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
      // Audio feedback is an enhancement; keep the ruler usable if audio is unavailable.
    }
  }, [request])

  const setImmediateValue = useCallback((nextValue: number) => {
    stopAnimation()
    const next = normalizedValue(nextValue, request)
    visualValueRef.current = next
    setVisualValue(next)
    setValue(next)
    playStepFeedback(next)
  }, [playStepFeedback, request, stopAnimation])

  const animateToValue = useCallback((nextValue: number, requestedDuration?: number) => {
    const target = normalizedValue(nextValue, request)
    const start = visualValueRef.current
    stopAnimation()
    setValue(target)

    if (start === target || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      visualValueRef.current = target
      setVisualValue(target)
      return
    }

    const distanceInSteps = Math.abs(target - start) / request.step
    const duration = requestedDuration ?? Math.min(720, Math.max(320, 240 + distanceInSteps * 18))
    const startedAt = performance.now()
    const animate = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration)
      const easedProgress = 1 - Math.pow(1 - progress, 3)
      const next = start + (target - start) * easedProgress
      visualValueRef.current = next
      setVisualValue(next)
      playStepFeedback(next)
      if (progress < 1) animationFrame.current = requestAnimationFrame(animate)
      else animationFrame.current = null
    }
    animationFrame.current = requestAnimationFrame(animate)
  }, [playStepFeedback, request, stopAnimation])

  const rememberSuggestion = useCallback((nextValue: number) => {
    const selected = normalizedValue(nextValue, request)
    const current = suggestionStoreRef.current
    const hasHistory = Object.prototype.hasOwnProperty.call(current, request.suggestionKey)
    const source = hasHistory ? current[request.suggestionKey] ?? [] : request.presets ?? []
    const existing = normalizedSuggestions(source, request)
    const alreadyIncluded = existing.includes(selected)
    let next = existing.filter((suggestion) => suggestion !== selected)

    if (!alreadyIncluded && next.length >= MAX_VALUE_SUGGESTIONS) {
      if (hasHistory) next = next.slice(1)
      else {
        const lowest = Math.min(...next)
        next.splice(next.indexOf(lowest), 1)
      }
    }

    next.push(selected)
    const updated = { ...current, [request.suggestionKey]: next.slice(-MAX_VALUE_SUGGESTIONS) }
    suggestionStoreRef.current = updated
    writeSuggestionStore(updated)
    setSuggestionStore(updated)
  }, [request])

  useEffect(() => {
    ruler.current?.focus()
    const handleEscape = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleEscape)
    return () => {
      window.removeEventListener('keydown', handleEscape)
      stopAnimation()
      if (audioContext.current?.state !== 'closed') void audioContext.current?.close().catch(() => undefined)
      audioContext.current = null
    }
  }, [onClose, stopAnimation])

  const changeBySteps = (steps: number) => setImmediateValue(visualValueRef.current + steps * request.step)

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End'].includes(event.key)) return
    prepareAudioFeedback()
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') changeBySteps(-1)
    else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') changeBySteps(1)
    else if (event.key === 'PageDown') changeBySteps(-10)
    else if (event.key === 'PageUp') changeBySteps(10)
    else if (event.key === 'Home') setImmediateValue(request.min)
    else if (event.key === 'End') setImmediateValue(request.max)
    event.preventDefault()
  }

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    prepareAudioFeedback()
    stopAnimation()
    const startValue = clampedValue(visualValueRef.current, request)
    const selectedValue = normalizedValue(startValue, request)
    visualValueRef.current = startValue
    setVisualValue(startValue)
    setValue(selectedValue)
    lastFeedbackValue.current = selectedValue
    drag.current = { pointerId: event.pointerId, startX: event.clientX, startValue }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const activeDrag = drag.current
    if (!activeDrag || activeDrag.pointerId !== event.pointerId) return
    const width = Math.max(1, event.currentTarget.getBoundingClientRect().width)
    const visibleSteps = request.mode === 'decimal' ? 80 : 10
    const stepDelta = (activeDrag.startX - event.clientX) / (width / visibleSteps)
    const rawValue = activeDrag.startValue + stepDelta * request.step
    const nextVisualValue = request.mode === 'integer' ? clampedValue(rawValue, request) : normalizedValue(rawValue, request)
    const selectedValue = normalizedValue(nextVisualValue, request)
    visualValueRef.current = nextVisualValue
    setVisualValue(nextVisualValue)
    setValue(selectedValue)
    playStepFeedback(selectedValue)
  }

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return
    drag.current = null
    const selectedValue = normalizedValue(visualValueRef.current, request)
    if (request.mode === 'integer') animateToValue(selectedValue, 160)
    else setImmediateValue(selectedValue)
  }

  return <main className={`value-adjuster value-adjuster--${request.mode}`} aria-label={`Adjust ${request.label}`}>
    <header className="value-adjuster__header">
      <img className="logo" src={logo} alt="decent" />
      <div className="value-adjuster__actions"><button className="value-adjuster__cancel" type="button" onClick={onClose}>Cancel</button><button className="value-adjuster__save" type="button" onClick={() => { rememberSuggestion(value); request.onSave(value); onClose() }}>Save</button></div>
    </header>
    <section className="value-adjuster__body">
      <p>{request.label}</p>
      <output aria-live="polite">{formatValue(visualValue, request.mode)}{request.unit && <small>{request.unit}</small>}</output>
      {valueHint && <div className="value-adjuster__value-hint"><span>{valueHint}</span></div>}
      <div ref={ruler} className="value-adjuster__scrubber" role="slider" tabIndex={0} aria-label={request.label} aria-valuemin={request.min} aria-valuemax={request.max} aria-valuenow={value} aria-valuetext={`${formatValue(value, request.mode)}${request.unit ?? ''}${valueHint ? `, ${valueHint}` : ''}`} onKeyDown={handleKeyDown} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}>
        <div className="value-adjuster__labels" aria-hidden="true">{labels.map((label, index) => {
          const inRange = label >= request.min && label <= request.max
          const isCenter = label === centerLabel
          return <span key={`${label}-${index}`} data-distance={Math.abs(index - 4)}>{inRange && !isCenter ? label : ''}</span>
        })}</div>
        <div className="value-adjuster__ruler">
          <div className="value-adjuster__ticks" aria-hidden="true">{ticks.map((tick, index) => <i key={index} style={{ left: `${tick.left}%` }} className={tick.major ? 'value-adjuster__tick--major' : ''} />)}</div>
          <span className="value-adjuster__pointer" aria-hidden="true" />
        </div>
      </div>
    </section>
    <footer className="value-adjuster__presets" aria-label={`${request.label} suggestions`}>{presets.map((preset) => <button key={preset} type="button" className={preset === value ? 'value-adjuster__preset value-adjuster__preset--active' : 'value-adjuster__preset'} onClick={() => { prepareAudioFeedback(); rememberSuggestion(preset); animateToValue(preset) }}>{formatSuggestion(preset, request.mode)}{request.unit && <small>{request.unit}</small>}</button>)}</footer>
  </main>
}

export function ValueAdjustmentProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<ValueAdjustmentRequest | null>(null)
  const openAdjustment = useCallback((nextRequest: ValueAdjustmentRequest) => setRequest(nextRequest), [])
  const closeAdjustment = useCallback(() => setRequest(null), [])

  return <ValueAdjustmentContext.Provider value={openAdjustment}>{children}{request && <ValueAdjustmentScreen request={request} onClose={closeAdjustment} />}</ValueAdjustmentContext.Provider>
}
