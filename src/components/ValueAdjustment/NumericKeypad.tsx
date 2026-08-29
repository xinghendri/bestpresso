import { useCallback, useRef } from 'react'
import type { MouseEvent, ReactNode, TouchEvent } from 'react'
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
  const lastTouchAt = useRef(0)

  const runAction = useCallback((action: KeypadAction | undefined) => {
    if (!action) return
    if (action === 'delete') onDelete()
    else if (action === 'dismiss') {
      if (!disabled) onDismiss()
    } else onKey(action === 'decimal' ? '.' : action)
  }, [disabled, onDelete, onDismiss, onKey])

  const handleTouchStart = (event: TouchEvent<HTMLElement>) => {
    const action = actionFromTarget(event.target)
    if (!action) return
    event.preventDefault()
    lastTouchAt.current = performance.now()
    runAction(action)
  }

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

  return <section className="value-adjuster__keypad" aria-label={`Enter ${label}`} onTouchStart={handleTouchStart} onMouseDown={handleMouseDown} onClick={handleAccessibleClick}>
    <div className="value-adjuster__keypad-grid">
      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(key)}
      <button className="value-adjuster__keypad-delete" type="button" data-keypad-action="delete" aria-label="Delete last digit"><span><img src={keypadBackspace} alt="" /><img src={keypadBackspaceXA} alt="" /><img src={keypadBackspaceXB} alt="" /></span></button>
      {key('0')}
      <button type="button" data-keypad-action="decimal" aria-label="Decimal point">.</button>
    </div>
    <button className="value-adjuster__keypad-dismiss" type="button" data-keypad-action="dismiss" aria-label="Dismiss number keypad" disabled={disabled}><img src={keypadChevronUp} alt="" /><img src={keypadChevronDown} alt="" /></button>
  </section>
}
