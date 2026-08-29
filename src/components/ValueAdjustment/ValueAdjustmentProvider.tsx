import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent, ReactNode } from 'react'
import logo from '../../assets/figma/decent-logo.png'
import { MAX_VALUE_SUGGESTIONS } from '../../domain/valueAdjustments'
import { ValueAdjustmentContext } from './ValueAdjustmentContext'
import type { ValueAdjustmentMode, ValueAdjustmentRequest } from './ValueAdjustmentContext'
import { gestureIncrement, maximumGesturePointers, modeForNumericDraft, modeForShortcut, normalizedNumericDraft } from './valueAdjustmentGestures'

const SUGGESTION_STORAGE_KEY = 'bestpresso.value-adjustment-suggestions.v2'
const MODE_STORAGE_KEY = 'bestpresso.value-adjustment-modes.v1'
type SuggestionStore = Partial<Record<ValueAdjustmentRequest['suggestionKey'], number[]>>
type ModeStore = Partial<Record<ValueAdjustmentRequest['suggestionKey'], ValueAdjustmentMode>>

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

const readModeStore = (): ModeStore => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(MODE_STORAGE_KEY) ?? '{}')
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, ValueAdjustmentMode] => entry[1] === 'integer' || entry[1] === 'decimal')) as ModeStore
  } catch {
    return {}
  }
}

const writeMode = (key: ValueAdjustmentRequest['suggestionKey'], mode: ValueAdjustmentMode) => {
  try {
    window.localStorage.setItem(MODE_STORAGE_KEY, JSON.stringify({ ...readModeStore(), [key]: mode }))
  } catch {
    // The selected ruler mode can safely fall back to the default when storage is unavailable.
  }
}

interface DragState {
  pointers: Map<number, number>
  startCenter: number
  startValue: number
  increment: number
  ended: boolean
}

const pointerCenter = (pointers: Map<number, number>) => [...pointers.values()].reduce((sum, position) => sum + position, 0) / Math.max(1, pointers.size)

function ValueAdjustmentScreen({ request, onClose }: { request: ValueAdjustmentRequest; onClose: () => void }) {
  const supportsModeToggle = Boolean(request.modes?.includes('integer') && request.modes.includes('decimal'))
  const storedMode = readModeStore()[request.suggestionKey]
  const initialMode = supportsModeToggle && storedMode && request.modes?.includes(storedMode) ? storedMode : request.mode
  const [mode, setMode] = useState<ValueAdjustmentMode>(initialMode)
  const activeRequest = useMemo<ValueAdjustmentRequest>(() => ({
    ...request,
    mode,
    step: supportsModeToggle ? mode === 'integer' ? 1 : 0.1 : request.step,
  }), [mode, request, supportsModeToggle])
  const [value, setValue] = useState(() => normalizedValue(request.value, { ...request, mode: initialMode, step: supportsModeToggle && initialMode === 'integer' ? 1 : request.step }))
  const [visualValue, setVisualValue] = useState(value)
  const ruler = useRef<HTMLDivElement>(null)
  const directInput = useRef<HTMLInputElement>(null)
  const drag = useRef<DragState | null>(null)
  const visualValueRef = useRef(value)
  const animationFrame = useRef<number | null>(null)
  const audioContext = useRef<AudioContext | null>(null)
  const lastFeedbackValue = useRef(value)
  const lastFeedbackAt = useRef(0)
  const fixedSelection = useRef<number | null>(null)
  const [editingValue, setEditingValue] = useState(false)
  const [draftValue, setDraftValue] = useState(formatValue(value, initialMode))
  const [suggestionStore, setSuggestionStore] = useState<SuggestionStore>(readSuggestionStore)
  const suggestionStoreRef = useRef(suggestionStore)
  const hasSuggestionHistory = Object.prototype.hasOwnProperty.call(suggestionStore, request.suggestionKey)
  const presets = useMemo(() => {
    const source = hasSuggestionHistory ? suggestionStore[request.suggestionKey] ?? [] : request.presets ?? []
    const values = supportsModeToggle
      ? Array.from(new Set(source.filter((suggestion) => Number.isFinite(suggestion) && suggestion >= request.min && suggestion <= request.max))).slice(-MAX_VALUE_SUGGESTIONS)
      : normalizedSuggestions(source, activeRequest)
    return [...values].sort((first, second) => first - second)
  }, [activeRequest, hasSuggestionHistory, request, suggestionStore, supportsModeToggle])
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

  const animateToValue = useCallback((nextValue: number, requestedDuration?: number, adjustment = activeRequest) => {
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
      playStepFeedback(next, adjustment)
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
    const existing = supportsModeToggle
      ? Array.from(new Set(source.filter((suggestion) => Number.isFinite(suggestion) && suggestion >= request.min && suggestion <= request.max)))
      : normalizedSuggestions(source, adjustment)
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
  }, [activeRequest, request, supportsModeToggle])

  const changeMode = (nextMode: ValueAdjustmentMode, targetValue = visualValueRef.current, animate = false) => {
    if (!supportsModeToggle || nextMode === mode) {
      if (animate) animateToValue(targetValue)
      return
    }
    stopAnimation()
    const nextRequest = { ...request, mode: nextMode, step: nextMode === 'integer' ? 1 : 0.1 }
    const nextValue = normalizedValue(targetValue, nextRequest)
    setMode(nextMode)
    if (animate) animateToValue(nextValue, undefined, nextRequest)
    else {
      visualValueRef.current = nextValue
      setVisualValue(nextValue)
      setValue(nextValue)
      lastFeedbackValue.current = nextValue
    }
    setDraftValue(formatValue(nextValue, nextMode))
  }

  const selectPreset = (preset: number) => {
    fixedSelection.current = null
    prepareAudioFeedback()
    const nextMode = modeForShortcut(preset, supportsModeToggle, mode)
    if (nextMode !== mode) changeMode(nextMode, preset, true)
    else animateToValue(preset)
  }

  const beginDirectEntry = () => {
    stopAnimation()
    setDraftValue(formatValue(normalizedValue(visualValueRef.current, activeRequest), mode))
    setEditingValue(true)
  }

  const requestForNumericDraft = (draft: string) => {
    const nextMode = supportsModeToggle ? modeForNumericDraft(draft, mode) : mode
    return { ...request, mode: nextMode, step: supportsModeToggle ? nextMode === 'integer' ? 1 : 0.1 : request.step }
  }

  const changeDirectEntry = (nextDraft: string) => {
    const normalizedDraft = normalizedNumericDraft(nextDraft)
    if (!/^\d*(?:\.\d*)?$/.test(normalizedDraft)) return
    setDraftValue(normalizedDraft)
    if (!normalizedDraft || normalizedDraft === '.') return
    const nextRequest = requestForNumericDraft(normalizedDraft)
    if (supportsModeToggle && nextRequest.mode !== mode) setMode(nextRequest.mode)
    const parsed = Number(normalizedDraft)
    if (Number.isFinite(parsed)) animateToValue(parsed, 280, nextRequest)
  }

  const commitDirectEntry = () => {
    const normalizedDraft = normalizedNumericDraft(draftValue)
    const parsed = Number(normalizedDraft)
    if (Number.isFinite(parsed) && normalizedDraft !== '') {
      const nextRequest = requestForNumericDraft(normalizedDraft)
      const nextValue = normalizedValue(parsed, nextRequest)
      stopAnimation()
      if (supportsModeToggle && nextRequest.mode !== mode) setMode(nextRequest.mode)
      visualValueRef.current = nextValue
      setVisualValue(nextValue)
      setValue(nextValue)
      setDraftValue(formatValue(nextValue, nextRequest.mode))
      lastFeedbackValue.current = nextValue
    } else setDraftValue(formatValue(value, mode))
    setEditingValue(false)
  }

  const saveAdjustment = () => {
    const normalizedDraft = normalizedNumericDraft(draftValue)
    const parsedDraft = Number(normalizedDraft)
    const saveRequest = editingValue && Number.isFinite(parsedDraft) && normalizedDraft !== '' ? requestForNumericDraft(normalizedDraft) : activeRequest
    const savedValue = editingValue && Number.isFinite(parsedDraft) && normalizedDraft !== '' ? normalizedValue(parsedDraft, saveRequest) : value
    if (fixedSelection.current !== savedValue) rememberSuggestion(savedValue, saveRequest)
    if (supportsModeToggle) writeMode(request.suggestionKey, saveRequest.mode)
    request.onSave(savedValue)
    onClose()
  }

  useEffect(() => {
    ruler.current?.focus()
    const handleEscape = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape' && document.activeElement !== directInput.current) onClose() }
    window.addEventListener('keydown', handleEscape)
    return () => {
      window.removeEventListener('keydown', handleEscape)
      stopAnimation()
      if (audioContext.current?.state !== 'closed') void audioContext.current?.close().catch(() => undefined)
      audioContext.current = null
    }
  }, [onClose, stopAnimation])

  useEffect(() => {
    if (!editingValue) return
    directInput.current?.focus()
    directInput.current?.select()
  }, [editingValue])

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
      drag.current = { pointers, startCenter: event.clientX, startValue, increment: activeRequest.step, ended: false }
    } else {
      currentDrag.pointers.set(event.pointerId, event.clientX)
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
    const selectedValue = normalizedValue(visualValueRef.current, activeDrag.increment > activeRequest.step ? { ...activeRequest, step: activeDrag.increment } : activeRequest)
    if (mode === 'integer') animateToValue(selectedValue, 160)
    else setImmediateValue(selectedValue)
  }

  const hasFixedSuggestions = Boolean(request.fixedSuggestions?.length)

  return <main className={`value-adjuster value-adjuster--${mode}${supportsModeToggle ? ' value-adjuster--mode-toggle' : ''}${hasFixedSuggestions ? ' value-adjuster--has-fixed-suggestions' : ''}`} aria-label={`Adjust ${request.label}`}>
    <header className="value-adjuster__header">
      <img className="logo" src={logo} alt="decent" />
      <div className="value-adjuster__actions"><button className="value-adjuster__cancel" type="button" onClick={onClose}>Cancel</button><button className="value-adjuster__save" type="button" onClick={saveAdjustment}>Save</button></div>
    </header>
    <section className="value-adjuster__body">
      {supportsModeToggle && <div className="value-adjuster__mode-selector" role="group" aria-label="Grind size number format">
        <button type="button" className={mode === 'integer' ? 'value-adjuster__mode-option value-adjuster__mode-option--active' : 'value-adjuster__mode-option'} aria-pressed={mode === 'integer'} onClick={() => changeMode('integer')}>Whole number</button>
        <button type="button" className={mode === 'decimal' ? 'value-adjuster__mode-option value-adjuster__mode-option--active' : 'value-adjuster__mode-option'} aria-pressed={mode === 'decimal'} onClick={() => changeMode('decimal')}>Decimal</button>
      </div>}
      <p>{request.label}</p>
      <div className="value-adjuster__value" aria-live="polite">
        {editingValue
          ? <input ref={directInput} type="text" inputMode="decimal" pattern="[0-9]*[.,]?[0-9]*" enterKeyHint="done" value={draftValue} aria-label={`Enter ${request.label}`} onChange={(event) => changeDirectEntry(event.target.value)} onBlur={commitDirectEntry} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); commitDirectEntry() } else if (event.key === 'Escape') { event.preventDefault(); setEditingValue(false) } }} />
          : <button type="button" onClick={beginDirectEntry} aria-label={`Enter ${request.label} with keypad`}>{formatValue(visualValue, mode)}{request.unit && <small>{request.unit}</small>}</button>}
      </div>
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
    <footer className="value-adjuster__presets">
      <div className="value-adjuster__preset-row" aria-label={`${request.label} suggestions`}>{presets.map((preset) => <button key={preset} type="button" className={preset === value ? 'value-adjuster__preset value-adjuster__preset--active' : 'value-adjuster__preset'} onClick={() => selectPreset(preset)}>{formatSuggestion(preset, modeForShortcut(preset, supportsModeToggle, mode))}{request.unit && <small>{request.unit}</small>}</button>)}</div>
      {request.fixedSuggestions && <div className="value-adjuster__preset-row value-adjuster__preset-row--fixed" aria-label={`${request.label} typical ratios`}>{request.fixedSuggestions.map((suggestion) => {
        const available = Number.isFinite(suggestion.value) && suggestion.value >= activeRequest.min && suggestion.value <= activeRequest.max
        const suggestionValue = available ? normalizedValue(suggestion.value, activeRequest) : suggestion.value
        return <button key={suggestion.label} type="button" className={available && suggestionValue === value ? 'value-adjuster__fixed-preset value-adjuster__fixed-preset--active' : 'value-adjuster__fixed-preset'} disabled={!available} aria-label={`${suggestion.label}, ${formatSuggestion(suggestion.value, mode)}${request.unit ?? ''}, ${suggestion.detail}`} onClick={() => { fixedSelection.current = suggestionValue; prepareAudioFeedback(); animateToValue(suggestionValue) }}>{suggestion.label}</button>
      })}</div>}
    </footer>
  </main>
}

export function ValueAdjustmentProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<ValueAdjustmentRequest | null>(null)
  const openAdjustment = useCallback((nextRequest: ValueAdjustmentRequest) => setRequest(nextRequest), [])
  const closeAdjustment = useCallback(() => setRequest(null), [])

  return <ValueAdjustmentContext.Provider value={openAdjustment}>{children}{request && <ValueAdjustmentScreen request={request} onClose={closeAdjustment} />}</ValueAdjustmentContext.Provider>
}
