import { useEffect, useRef } from 'react'
import type { MouseEvent, ReactNode } from 'react'
import keypadBackspace from '../../assets/figma/keypad-backspace.svg'
import keypadBackspaceXA from '../../assets/figma/keypad-backspace-x-a.svg'
import keypadBackspaceXB from '../../assets/figma/keypad-backspace-x-b.svg'
import keypadChevronDown from '../../assets/figma/keypad-chevron-down.svg'
import keypadChevronUp from '../../assets/figma/keypad-chevron-up.svg'

type KeypadAction = 'delete' | 'dismiss' | 'decimal' | `${number}`

interface NumericKeypadProps {
  disabled: boolean
  label: string
  onDelete: () => void
  onDismiss: () => void
  onKey: (key: string) => void
}

const actionFromTarget = (target: EventTarget | null) => target instanceof Element
  ? target.closest<HTMLElement>('[data-keypad-action]')?.dataset.keypadAction as KeypadAction | undefined
  : undefined

export function NumericKeypad({ disabled, label, onDelete, onDismiss, onKey }: NumericKeypadProps) {
  const root = useRef<HTMLElement>(null)
  const lastTouchAt = useRef(0)
  const actions = useRef({ disabled, onDelete, onDismiss, onKey })

  useEffect(() => {
    actions.current = { disabled, onDelete, onDismiss, onKey }
  }, [disabled, onDelete, onDismiss, onKey])

  const runAction = (action: KeypadAction | undefined) => {
    if (!action) return
    const current = actions.current
    if (action === 'delete') current.onDelete()
    else if (action === 'dismiss') {
      if (!current.disabled) current.onDismiss()
    } else current.onKey(action === 'decimal' ? '.' : action)
  }

  useEffect(() => {
    const element = root.current
    if (!element) return
    const handleTouchStart = (event: globalThis.TouchEvent) => {
      const touch = event.changedTouches.item(0)
      const touchedElement = touch ? document.elementFromPoint(touch.clientX, touch.clientY) : event.target
      const action = actionFromTarget(touchedElement)
      if (!action || !(touchedElement instanceof Node) || !element.contains(touchedElement)) return
      event.preventDefault()
      lastTouchAt.current = performance.now()
      runAction(action)
    }
    element.addEventListener('touchstart', handleTouchStart, { passive: false })
    return () => element.removeEventListener('touchstart', handleTouchStart)
  }, [])

  const handleMouseDown = (event: MouseEvent<HTMLElement>) => {
    const action = actionFromTarget(event.target)
    if (!action || performance.now() - lastTouchAt.current < 700) return
    event.preventDefault()
    runAction(action)
  }

  const handleAccessibleClick = (event: MouseEvent<HTMLElement>) => {
    if (event.detail !== 0) return
    runAction(actionFromTarget(event.target))
  }

  const key = (value: string): ReactNode => <button key={value} type="button" data-keypad-action={value}>{value}</button>

  return <section ref={root} className="value-adjuster__keypad" aria-label={`Enter ${label}`} onMouseDown={handleMouseDown} onClick={handleAccessibleClick}>
    <div className="value-adjuster__keypad-grid">
      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(key)}
      <button className="value-adjuster__keypad-delete" type="button" data-keypad-action="delete" aria-label="Delete last digit"><span><img src={keypadBackspace} alt="" /><img src={keypadBackspaceXA} alt="" /><img src={keypadBackspaceXB} alt="" /></span></button>
      {key('0')}
      <button type="button" data-keypad-action="decimal" aria-label="Decimal point">.</button>
    </div>
    <button className="value-adjuster__keypad-dismiss" type="button" data-keypad-action="dismiss" aria-label="Dismiss number keypad" disabled={disabled}><img src={keypadChevronUp} alt="" /><img src={keypadChevronDown} alt="" /></button>
  </section>
}
