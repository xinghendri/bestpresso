import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent, ReactNode } from 'react'
import logo from '../../assets/figma/decent-logo.png'
import { ValueAdjustmentContext } from './ValueAdjustmentContext'
import type { ValueAdjustmentMode, ValueAdjustmentRequest } from './ValueAdjustmentContext'

const formatValue = (value: number, mode: ValueAdjustmentMode) => mode === 'decimal' ? value.toFixed(1) : String(Math.round(value))

const normalizedValue = (value: number, request: ValueAdjustmentRequest) => {
  const steps = Math.round((Math.min(request.max, Math.max(request.min, value)) - request.min) / request.step)
  const stepped = request.min + steps * request.step
  return Number(stepped.toFixed(request.mode === 'decimal' ? 1 : 0))
}

const fallbackPresets = (request: ValueAdjustmentRequest) => {
  const offsets = request.mode === 'decimal' ? [-5, -2, -1, 1, 2, 5] : [-10, -5, -2, 2, 5, 10]
  return offsets.map((offset) => normalizedValue(request.value + offset, request))
}

function ValueAdjustmentScreen({ request, onClose }: { request: ValueAdjustmentRequest; onClose: () => void }) {
  const [value, setValue] = useState(() => normalizedValue(request.value, request))
  const ruler = useRef<HTMLDivElement>(null)
  const drag = useRef<{ pointerId: number; startX: number; startValue: number } | null>(null)
  const presets = useMemo(() => Array.from(new Set((request.presets ?? fallbackPresets(request)).map((preset) => normalizedValue(preset, request)))).filter((preset) => preset >= request.min && preset <= request.max), [request])
  const centerLabel = Math.round(value)
  const labels = Array.from({ length: 9 }, (_, index) => centerLabel + index - 4)
  const tickCount = request.mode === 'decimal' ? 81 : 33

  useEffect(() => {
    ruler.current?.focus()
    const handleEscape = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose])

  const changeBySteps = (steps: number) => setValue((current) => normalizedValue(current + steps * request.step, request))

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') changeBySteps(-1)
    else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') changeBySteps(1)
    else if (event.key === 'PageDown') changeBySteps(-10)
    else if (event.key === 'PageUp') changeBySteps(10)
    else if (event.key === 'Home') setValue(request.min)
    else if (event.key === 'End') setValue(request.max)
    else return
    event.preventDefault()
  }

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    drag.current = { pointerId: event.pointerId, startX: event.clientX, startValue: value }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const activeDrag = drag.current
    if (!activeDrag || activeDrag.pointerId !== event.pointerId) return
    const width = Math.max(1, event.currentTarget.getBoundingClientRect().width)
    const visibleSteps = request.mode === 'decimal' ? 80 : 10
    const stepDelta = (activeDrag.startX - event.clientX) / (width / visibleSteps)
    setValue(normalizedValue(activeDrag.startValue + stepDelta * request.step, request))
  }

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId === event.pointerId) drag.current = null
  }

  return <main className={`value-adjuster value-adjuster--${request.mode}`} aria-label={`Adjust ${request.label}`}>
    <header className="value-adjuster__header">
      <img className="logo" src={logo} alt="decent" />
      <div className="value-adjuster__actions"><button className="value-adjuster__cancel" type="button" onClick={onClose}>Cancel</button><button className="value-adjuster__save" type="button" onClick={() => { request.onSave(value); onClose() }}>Save</button></div>
    </header>
    <section className="value-adjuster__body">
      <p>{request.label}</p>
      <output aria-live="polite">{formatValue(value, request.mode)}{request.unit && <small>{request.unit}</small>}</output>
      <div className="value-adjuster__labels" aria-hidden="true">{labels.map((label, index) => {
        const inRange = label >= request.min && label <= request.max
        const isCenter = label === centerLabel
        return <button key={`${label}-${index}`} type="button" tabIndex={-1} disabled={!inRange || isCenter} onClick={() => setValue(normalizedValue(label, request))} data-distance={Math.abs(index - 4)}>{inRange && !isCenter ? label : ''}</button>
      })}</div>
      <div ref={ruler} className="value-adjuster__ruler" role="slider" tabIndex={0} aria-label={request.label} aria-valuemin={request.min} aria-valuemax={request.max} aria-valuenow={value} aria-valuetext={`${formatValue(value, request.mode)}${request.unit ?? ''}`} onKeyDown={handleKeyDown} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}>
        <div className="value-adjuster__ticks" aria-hidden="true">{Array.from({ length: tickCount }, (_, index) => <i key={index} className={index % (request.mode === 'decimal' ? 10 : 4) === 0 ? 'value-adjuster__tick--major' : ''} />)}</div>
        <span className="value-adjuster__pointer" aria-hidden="true" />
      </div>
    </section>
    <footer className="value-adjuster__presets" aria-label={`${request.label} presets`}>{presets.map((preset) => <button key={preset} type="button" className={preset === value ? 'value-adjuster__preset value-adjuster__preset--active' : 'value-adjuster__preset'} onClick={() => setValue(preset)}>{formatValue(preset, request.mode)}{request.unit && <small>{request.unit}</small>}</button>)}</footer>
  </main>
}

export function ValueAdjustmentProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<ValueAdjustmentRequest | null>(null)
  const openAdjustment = useCallback((nextRequest: ValueAdjustmentRequest) => setRequest(nextRequest), [])
  const closeAdjustment = useCallback(() => setRequest(null), [])

  return <ValueAdjustmentContext.Provider value={openAdjustment}>{children}{request && <ValueAdjustmentScreen request={request} onClose={closeAdjustment} />}</ValueAdjustmentContext.Provider>
}
