import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent, ReactNode } from 'react'
import logo from '../../assets/figma/decent-logo.png'
import { MAX_VALUE_SUGGESTIONS } from '../../domain/valueAdjustments'
import { NumericKeypad } from './NumericKeypad'
import { ValueAdjustmentContext } from './ValueAdjustmentContext'
import type { ValueAdjustmentMode, ValueAdjustmentRequest } from './ValueAdjustmentContext'
import { appendNumericKey, gestureIncrement, maximumGesturePointers, normalizedNumericDraft, numericDraftRangeIssue, removeNumericKey } from './valueAdjustmentGestures'

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

interface DragState {
  pointers: Map<number, number>
  startCenter: number
  startValue: number
  increment: number
  maxPointers: number
  moved: boolean
  ended: boolean
}

const pointerCenter = (pointers: Map<number, number>) => [...pointers.values()].reduce((sum, position) => sum + position, 0) / Math.max(1, pointers.size)

function ValueAdjustmentScreen({ request, onClose }: { request: ValueAdjustmentRequest; onClose: () => void }) {
  const mode = request.mode
  const activeRequest = request
  const [value, setValue] = useState(() => normalizedValue(request.value, request))
  const [visualValue, setVisualValue] = useState(value)
  const ruler = useRef<HTMLDivElement>(null)
  const drag = useRef<DragState | null>(null)
  const visualValueRef = useRef(value)
  const animationFrame = useRef<number | null>(null)
  const audioContext = useRef<AudioContext | null>(null)
  const lastFeedbackValue = useRef(value)
  const lastFeedbackAt = useRef(0)
  const fixedSelection = useRef<number | null>(null)
  const directEntryStart = useRef(value)
  const replaceDraftOnKey = useRef(false)
  const directDraftText = useRef<HTMLSpanElement>(null)
  const directEntryAnimation = useRef<number | null>(null)
  const completedSingleFingerSwipes = useRef(0)
  const gestureTipShown = useRef(false)
  const gestureTipTimer = useRef<number | null>(null)
  const [editingValue, setEditingValue] = useState(false)
  const [gestureTip, setGestureTip] = useState<string | null>(null)
  const [draftValue, setDraftValue] = useState(formatValue(value, mode))
  const draftValueRef = useRef(draftValue)
  const draftRangeIssue = editingValue ? numericDraftRangeIssue(draftValue, request.min, request.max) : null
  const directInputError = draftRangeIssue === 'above'
    ? `Maximum is ${request.max.toLocaleString()}.`
    : draftRangeIssue === 'below'
      ? `Minimum is ${request.min.toLocaleString()}.`
      : draftRangeIssue === 'required' ? 'Enter a number.' : null
  const [suggestionStore, setSuggestionStore] = useState<SuggestionStore>(readSuggestionStore)
  const suggestionStoreRef = useRef(suggestionStore)
  const hasSuggestionHistory = Object.prototype.hasOwnProperty.call(suggestionStore, request.suggestionKey)
  const presets = useMemo(() => {
    const source = hasSuggestionHistory ? suggestionStore[request.suggestionKey] ?? [] : request.presets ?? []
    const values = normalizedSuggestions(source, activeRequest)
    return [...values].sort((first, second) => first - second)
  }, [activeRequest, hasSuggestionHistory, request, suggestionStore])
  const valueHint = request.valueHint?.(normalizedValue(visualValue, activeRequest))
  const centerLabel = Math.round(visualValue)
  const labels = Array.from({ length: 9 }, (_, index) => centerLabel + index - 4)
  const minorTickStep = mode === 'decimal' ? 0.1 : 0.25
  const tickAnchor = Math.floor(visualValue / minorTickStep) * minorTickStep
  const ticks = Array.from({ length: mode === 'decimal' ? 101 : 41 }, (_, index) => {
    const offset = index - (mode === 'decimal' ? 50 : 20)
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

  const playKeypadFeedback = useCallback(() => {
    prepareAudioFeedback()
    const context = audioContext.current
    if (!context || context.state === 'closed') return

    try {
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
      // Sound is progressive enhancement; keypad input remains functional without it.
    }
  }, [prepareAudioFeedback])

  const playStepFeedback = useCallback((nextValue: number, adjustment = activeRequest) => {
    const selectedValue = normalizedValue(nextValue, adjustment)
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
      oscillator.frequency.setValueAtTime(adjustment.mode === 'integer' ? 460 : 560, startedAt)
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
  }, [activeRequest])

  const setImmediateValue = useCallback((nextValue: number) => {
    stopAnimation()
    const next = normalizedValue(nextValue, activeRequest)
    visualValueRef.current = next
    setVisualValue(next)
    setValue(next)
    playStepFeedback(next)
  }, [activeRequest, playStepFeedback, stopAnimation])

  const animateToValue = useCallback((nextValue: number, requestedDuration?: number, adjustment = activeRequest, feedback = true) => {
    const target = normalizedValue(nextValue, adjustment)
    const start = visualValueRef.current
    stopAnimation()
    setValue(target)

    if (start === target || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      visualValueRef.current = target
      setVisualValue(target)
      return
    }

    const distanceInSteps = Math.abs(target - start) / adjustment.step
    const duration = requestedDuration ?? Math.min(720, Math.max(320, 240 + distanceInSteps * 18))
    const startedAt = performance.now()
    const animate = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration)
      const easedProgress = 1 - Math.pow(1 - progress, 3)
      const next = start + (target - start) * easedProgress
      visualValueRef.current = next
      setVisualValue(next)
      if (feedback) playStepFeedback(next, adjustment)
      if (progress < 1) animationFrame.current = requestAnimationFrame(animate)
      else animationFrame.current = null
    }
    animationFrame.current = requestAnimationFrame(animate)
  }, [activeRequest, playStepFeedback, stopAnimation])

  const rememberSuggestion = useCallback((nextValue: number, adjustment = activeRequest) => {
    const selected = normalizedValue(nextValue, adjustment)
    const current = suggestionStoreRef.current
    const hasHistory = Object.prototype.hasOwnProperty.call(current, request.suggestionKey)
    const source = hasHistory ? current[request.suggestionKey] ?? [] : request.presets ?? []
    const existing = normalizedSuggestions(source, adjustment)
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
  }, [activeRequest, request])

  const selectPreset = (preset: number) => {
    fixedSelection.current = null
    prepareAudioFeedback()
    animateToValue(preset)
  }

  const beginDirectEntry = () => {
    stopAnimation()
    directEntryStart.current = normalizedValue(visualValueRef.current, activeRequest)
    replaceDraftOnKey.current = true
    const startingDraft = formatValue(normalizedValue(visualValueRef.current, activeRequest), mode)
    draftValueRef.current = startingDraft
    setDraftValue(startingDraft)
    setEditingValue(true)
  }

  const queueDirectEntry = (nextDraft: string) => {
    const normalizedDraft = normalizedNumericDraft(nextDraft)
    if (!/^\d*(?:\.\d*)?$/.test(normalizedDraft)) return
    stopAnimation()
    draftValueRef.current = normalizedDraft
    if (directDraftText.current) directDraftText.current.textContent = normalizedDraft || '—'
    if (directEntryAnimation.current !== null) window.clearTimeout(directEntryAnimation.current)
    directEntryAnimation.current = null
    if (!normalizedDraft || normalizedDraft === '.') return
    const parsed = Number(normalizedDraft)
    if (Number.isFinite(parsed)) {
      directEntryAnimation.current = window.setTimeout(() => {
        directEntryAnimation.current = null
        setDraftValue(normalizedDraft)
        animateToValue(parsed, 220)
      }, 1500)
    }
  }

  const pressKeypadKey = (key: string) => {
    playKeypadFeedback()
    const nextDraft = appendNumericKey(draftValueRef.current, key, replaceDraftOnKey.current)
    replaceDraftOnKey.current = false
    queueDirectEntry(nextDraft)
  }

  const deleteKeypadKey = () => {
    playKeypadFeedback()
    replaceDraftOnKey.current = false
    queueDirectEntry(removeNumericKey(draftValueRef.current))
  }

  const cancelDirectEntry = useCallback(() => {
    stopAnimation()
    if (directEntryAnimation.current !== null) window.clearTimeout(directEntryAnimation.current)
    directEntryAnimation.current = null
    const starting = directEntryStart.current
    visualValueRef.current = starting
    setVisualValue(starting)
    setValue(starting)
    const startingDraft = formatValue(starting, mode)
    draftValueRef.current = startingDraft
    setDraftValue(startingDraft)
    lastFeedbackValue.current = starting
    setEditingValue(false)
  }, [mode, stopAnimation])

  const commitDirectEntry = () => {
    if (directEntryAnimation.current !== null) window.clearTimeout(directEntryAnimation.current)
    directEntryAnimation.current = null
    const normalizedDraft = normalizedNumericDraft(draftValueRef.current)
    const parsed = Number(normalizedDraft)
    if (numericDraftRangeIssue(normalizedDraft, request.min, request.max)) return
    if (Number.isFinite(parsed) && normalizedDraft !== '') {
      const nextValue = normalizedValue(parsed, activeRequest)
      stopAnimation()
      visualValueRef.current = nextValue
      setVisualValue(nextValue)
      setValue(nextValue)
      const committedDraft = formatValue(nextValue, mode)
      draftValueRef.current = committedDraft
      setDraftValue(committedDraft)
      lastFeedbackValue.current = nextValue
    } else setDraftValue(formatValue(value, mode))
    setEditingValue(false)
  }

  const saveAdjustment = () => {
    const normalizedDraft = normalizedNumericDraft(draftValueRef.current)
    const parsedDraft = Number(normalizedDraft)
    if (editingValue && numericDraftRangeIssue(normalizedDraft, request.min, request.max)) return
    const savedValue = editingValue && Number.isFinite(parsedDraft) && normalizedDraft !== '' ? normalizedValue(parsedDraft, activeRequest) : value
    if (fixedSelection.current !== savedValue) rememberSuggestion(savedValue)
    request.onSave(savedValue)
    onClose()
  }

  useEffect(() => {
    ruler.current?.focus()
    return () => {
      stopAnimation()
      if (directEntryAnimation.current !== null) window.clearTimeout(directEntryAnimation.current)
      directEntryAnimation.current = null
      if (gestureTipTimer.current !== null) window.clearTimeout(gestureTipTimer.current)
      gestureTipTimer.current = null
      if (audioContext.current?.state !== 'closed') void audioContext.current?.close().catch(() => undefined)
      audioContext.current = null
    }
  }, [stopAnimation])

  useEffect(() => {
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (editingValue) cancelDirectEntry()
      else onClose()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [cancelDirectEntry, editingValue, onClose])

  const changeBySteps = (steps: number) => {
    fixedSelection.current = null
    setImmediateValue(visualValueRef.current + steps * activeRequest.step)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End'].includes(event.key)) return
    prepareAudioFeedback()
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') changeBySteps(-1)
    else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') changeBySteps(1)
    else if (event.key === 'PageDown') changeBySteps(-10)
    else if (event.key === 'PageUp') changeBySteps(10)
    else if (event.key === 'Home') { fixedSelection.current = null; setImmediateValue(activeRequest.min) }
    else if (event.key === 'End') { fixedSelection.current = null; setImmediateValue(activeRequest.max) }
    event.preventDefault()
  }

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (editingValue) {
      const rangeIssue = numericDraftRangeIssue(draftValueRef.current, request.min, request.max)
      if (rangeIssue) cancelDirectEntry()
      else commitDirectEntry()
    }
    prepareAudioFeedback()
    stopAnimation()
    fixedSelection.current = null
    const maximumPointers = maximumGesturePointers(request.suggestionKey === 'grindSetting')
    const currentDrag = drag.current
    if (!currentDrag) {
      const startValue = clampedValue(visualValueRef.current, activeRequest)
      const selectedValue = normalizedValue(startValue, activeRequest)
      const pointers = new Map([[event.pointerId, event.clientX]])
      visualValueRef.current = startValue
      setVisualValue(startValue)
      setValue(selectedValue)
      lastFeedbackValue.current = selectedValue
      drag.current = { pointers, startCenter: event.clientX, startValue, increment: activeRequest.step, maxPointers: 1, moved: false, ended: false }
    } else {
      currentDrag.pointers.set(event.pointerId, event.clientX)
      currentDrag.maxPointers = Math.max(currentDrag.maxPointers, currentDrag.pointers.size)
      if (currentDrag.pointers.size > maximumPointers) currentDrag.ended = true
      else {
        currentDrag.startCenter = pointerCenter(currentDrag.pointers)
        currentDrag.startValue = visualValueRef.current
      }
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const activeDrag = drag.current
    if (!activeDrag || activeDrag.ended || !activeDrag.pointers.has(event.pointerId)) return
    activeDrag.pointers.set(event.pointerId, event.clientX)
    const increment = gestureIncrement(mode, activeDrag.pointers.size, request.suggestionKey === 'grindSetting')
    if (increment === null) return
    activeDrag.increment = increment
    const track = event.currentTarget.querySelector<HTMLElement>('.value-adjuster__scrubber-track')
    const width = Math.max(1, track?.getBoundingClientRect().width ?? event.currentTarget.getBoundingClientRect().width)
    const visibleSteps = activeDrag.pointers.size === 1 ? mode === 'decimal' ? 80 : 12 : 12
    const stepDelta = (activeDrag.startCenter - pointerCenter(activeDrag.pointers)) / (width / visibleSteps)
    if (Math.abs(stepDelta) >= 0.15) activeDrag.moved = true
    const rawValue = activeDrag.startValue + stepDelta * increment
    const coarseRequest = increment > activeRequest.step ? { ...activeRequest, step: increment } : activeRequest
    const nextVisualValue = increment > activeRequest.step
      ? normalizedValue(rawValue, coarseRequest)
      : mode === 'integer' ? clampedValue(rawValue, activeRequest) : normalizedValue(rawValue, activeRequest)
    const selectedValue = normalizedValue(nextVisualValue, coarseRequest)
    visualValueRef.current = nextVisualValue
    setVisualValue(nextVisualValue)
    setValue(selectedValue)
    playStepFeedback(selectedValue)
  }

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    const activeDrag = drag.current
    if (!activeDrag?.pointers.has(event.pointerId)) return
    activeDrag.pointers.delete(event.pointerId)
    if (activeDrag.pointers.size) {
      activeDrag.ended = true
      return
    }
    drag.current = null
    if (activeDrag.moved && activeDrag.maxPointers === 1 && !gestureTipShown.current && (request.suggestionKey === 'grindSetting' || request.suggestionKey === 'targetYield')) {
      completedSingleFingerSwipes.current += 1
      if (completedSingleFingerSwipes.current > 3) {
        gestureTipShown.current = true
        setGestureTip(request.suggestionKey === 'grindSetting'
          ? 'Swipe with two fingers for steps of 10, or three fingers for steps of 100.'
          : 'Swipe with two fingers to move in steps of 10.')
        gestureTipTimer.current = window.setTimeout(() => {
          gestureTipTimer.current = null
          setGestureTip(null)
        }, 5000)
      }
    }
    const selectedValue = normalizedValue(visualValueRef.current, activeDrag.increment > activeRequest.step ? { ...activeRequest, step: activeDrag.increment } : activeRequest)
    if (mode === 'integer') animateToValue(selectedValue, 160)
    else setImmediateValue(selectedValue)
  }

  const hasFixedSuggestions = Boolean(request.fixedSuggestions?.length)

  return <main className={`value-adjuster value-adjuster--${mode}${hasFixedSuggestions ? ' value-adjuster--has-fixed-suggestions' : ''}${editingValue ? ' value-adjuster--keyboard' : ''}`} aria-label={`Adjust ${request.label}`}>
    {gestureTip && <div className="system-messages"><div className="system-message value-adjuster__gesture-tip" role="status" aria-live="polite"><span className="value-adjuster__gesture-tip-icon" aria-hidden="true">i</span><span>{gestureTip}</span></div></div>}
    <header className="value-adjuster__header">
      <img className="logo" src={logo} alt="decent" />
      <div className="value-adjuster__actions"><button className="value-adjuster__cancel" type="button" onClick={onClose}>Cancel</button><button className="value-adjuster__save" type="button" disabled={Boolean(directInputError)} onClick={saveAdjustment}>Save</button></div>
    </header>
    <section className="value-adjuster__body">
      <p>{request.label}</p>
      <div className="value-adjuster__value" aria-live="polite">
        {editingValue
          ? <span className="value-adjuster__direct-value" aria-label={`${request.label}, ${draftValue || 'empty'}`}><span ref={directDraftText}>{draftValue || '—'}</span>{request.unit && <small>{request.unit}</small>}</span>
          : <button type="button" onClick={beginDirectEntry} aria-label={`Enter ${request.label} with keypad`}>{formatValue(visualValue, mode)}{request.unit && <small>{request.unit}</small>}</button>}
      </div>
      {directInputError && <p className="value-adjuster__validation" role="alert">{directInputError}</p>}
      {valueHint && <div className="value-adjuster__value-hint"><span>{valueHint}</span></div>}
      <div ref={ruler} className="value-adjuster__scrubber" role="slider" tabIndex={0} aria-label={request.label} aria-valuemin={activeRequest.min} aria-valuemax={activeRequest.max} aria-valuenow={value} aria-valuetext={`${formatValue(value, mode)}${request.unit ?? ''}${valueHint ? `, ${valueHint}` : ''}`} onKeyDown={handleKeyDown} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}>
        <div className="value-adjuster__scrubber-track">
          <div className="value-adjuster__labels" aria-hidden="true">{labels.map((label, index) => {
            const inRange = label >= activeRequest.min && label <= activeRequest.max
            const isCenter = label === centerLabel
            return <span key={`${label}-${index}`} data-distance={Math.abs(index - 4)}>{inRange && !isCenter ? label : ''}</span>
          })}</div>
          <div className="value-adjuster__ruler">
            <div className="value-adjuster__ticks" aria-hidden="true">{ticks.map((tick, index) => <i key={index} style={{ left: `${tick.left}%` }} className={tick.major ? 'value-adjuster__tick--major' : ''} />)}</div>
            <span className="value-adjuster__pointer" aria-hidden="true" />
          </div>
        </div>
      </div>
    </section>
    {editingValue && <NumericKeypad disabled={Boolean(directInputError)} label={request.label} onDelete={deleteKeypadKey} onDismiss={() => { playKeypadFeedback(); commitDirectEntry() }} onKey={pressKeypadKey} />}
    {!editingValue && <footer className="value-adjuster__presets">
      <div className="value-adjuster__preset-row" aria-label={`${request.label} suggestions`}>{presets.map((preset) => <button key={preset} type="button" className={preset === value ? 'value-adjuster__preset value-adjuster__preset--active' : 'value-adjuster__preset'} onClick={() => selectPreset(preset)}>{formatSuggestion(preset, mode)}{request.unit && <small>{request.unit}</small>}</button>)}</div>
      {request.fixedSuggestions && <div className="value-adjuster__preset-row value-adjuster__preset-row--fixed" aria-label={`${request.label} typical ratios`}>{request.fixedSuggestions.map((suggestion) => {
        const available = Number.isFinite(suggestion.value) && suggestion.value >= activeRequest.min && suggestion.value <= activeRequest.max
        const suggestionValue = available ? normalizedValue(suggestion.value, activeRequest) : suggestion.value
        return <button key={suggestion.label} type="button" className={available && suggestionValue === value ? 'value-adjuster__fixed-preset value-adjuster__fixed-preset--active' : 'value-adjuster__fixed-preset'} disabled={!available} aria-label={`${suggestion.label}, ${formatSuggestion(suggestion.value, mode)}${request.unit ?? ''}, ${suggestion.detail}`} onClick={() => { fixedSelection.current = suggestionValue; prepareAudioFeedback(); animateToValue(suggestionValue) }}>{suggestion.label}</button>
      })}</div>}
    </footer>}
  </main>
}

export function ValueAdjustmentProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<ValueAdjustmentRequest | null>(null)
  const openAdjustment = useCallback((nextRequest: ValueAdjustmentRequest) => setRequest(nextRequest), [])
  const closeAdjustment = useCallback(() => setRequest(null), [])

  return <ValueAdjustmentContext.Provider value={openAdjustment}>{children}{request && <ValueAdjustmentScreen request={request} onClose={closeAdjustment} />}</ValueAdjustmentContext.Provider>
}
