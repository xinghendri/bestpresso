import { createContext, useContext } from 'react'

export type ValueAdjustmentMode = 'integer' | 'decimal'

export interface ValueAdjustmentRequest {
  label: string
  value: number
  unit?: string
  min: number
  max: number
  step: number
  mode: ValueAdjustmentMode
  presets?: number[]
  onSave: (value: number) => void
}

export type OpenAdjustment = (request: ValueAdjustmentRequest) => void

export const ValueAdjustmentContext = createContext<OpenAdjustment | null>(null)

export function useValueAdjustment() {
  const openAdjustment = useContext(ValueAdjustmentContext)
  if (!openAdjustment) throw new Error('useValueAdjustment must be used inside ValueAdjustmentProvider')
  return openAdjustment
}
