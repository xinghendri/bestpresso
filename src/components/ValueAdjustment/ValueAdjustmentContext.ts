import { createContext, useContext } from 'react'
import type { FixedValueSuggestion, ValueAdjustmentKey, ValueAdjustmentMode } from '../../domain/valueAdjustments'

export type { ValueAdjustmentMode } from '../../domain/valueAdjustments'

export interface ValueAdjustmentRequest {
  label: string
  value: number
  unit?: string
  min: number
  max: number
  step: number
  mode: ValueAdjustmentMode
  modes?: readonly ValueAdjustmentMode[]
  suggestionKey: ValueAdjustmentKey
  presets?: readonly number[]
  fixedSuggestions?: readonly FixedValueSuggestion[]
  valueHint?: (value: number) => string | undefined
  onSave: (value: number) => void
}

export type OpenAdjustment = (request: ValueAdjustmentRequest) => void

export const ValueAdjustmentContext = createContext<OpenAdjustment | null>(null)

export function useValueAdjustment() {
  const openAdjustment = useContext(ValueAdjustmentContext)
  if (!openAdjustment) throw new Error('useValueAdjustment must be used inside ValueAdjustmentProvider')
  return openAdjustment
}
