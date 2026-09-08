import { createContext, useContext } from 'react'
import type { FixedValueSuggestion, ValueAdjustmentKey, ValueAdjustmentMode } from '../../domain/valueAdjustments'

export type { ValueAdjustmentMode } from '../../domain/valueAdjustments'

export interface ValueAdjustmentVariant {
  id: string
  label: string
  value: number
  unit?: string
  min: number
  max: number
  step: number
  mode: ValueAdjustmentMode
  suggestionKey: ValueAdjustmentKey
  presets?: readonly number[]
}

export interface ValueAdjustmentRequest {
  label: string
  value: number
  unit?: string
  min: number
  max: number
  step: number
  mode: ValueAdjustmentMode
  suggestionKey: ValueAdjustmentKey
  presets?: readonly number[]
  fixedSuggestions?: readonly FixedValueSuggestion[]
  valueHint?: (value: number) => string | undefined
  variants?: readonly ValueAdjustmentVariant[]
  selectedVariantId?: string
  onSave: (value: number, variantId?: string) => void
}

export type OpenAdjustment = (request: ValueAdjustmentRequest) => void

export const ValueAdjustmentContext = createContext<OpenAdjustment | null>(null)

export function useValueAdjustment() {
  const openAdjustment = useContext(ValueAdjustmentContext)
  if (!openAdjustment) throw new Error('useValueAdjustment must be used inside ValueAdjustmentProvider')
  return openAdjustment
}
