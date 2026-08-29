import type { EditableMachineSetting, EditableProfileSetting } from './brewing'

export type ValueAdjustmentKey = EditableMachineSetting | EditableProfileSetting
export type ValueAdjustmentMode = 'integer' | 'decimal'

export interface FixedValueSuggestion {
  label: string
  detail: string
  value: number
}

export interface ValueAdjustmentDefinition {
  title: string
  min: number
  max: number
  step: number
  mode: ValueAdjustmentMode
  modes?: readonly ValueAdjustmentMode[]
  defaultValue?: number
  suggestions: readonly number[]
}

export const MAX_VALUE_SUGGESTIONS = 8

export const VALUE_ADJUSTMENTS = {
  hotWaterVolume: {
    title: 'Hot water volume',
    min: 0,
    max: 250,
    step: 1,
    mode: 'integer',
    suggestions: [],
  },
  hotWaterTemperature: {
    title: 'Hot water temperature',
    min: 50,
    max: 95,
    step: 1,
    mode: 'integer',
    suggestions: [],
  },
  steamTemperature: {
    title: 'Steam target temperature',
    min: 135,
    max: 170,
    step: 1,
    mode: 'integer',
    suggestions: [150, 155, 160, 165, 170],
  },
  steamDuration: {
    title: 'Steam duration',
    min: 0,
    max: 120,
    step: 1,
    mode: 'integer',
    suggestions: [],
  },
  steamFlow: {
    title: 'Steam flow',
    min: 0.4,
    max: 2.5,
    step: 0.1,
    mode: 'decimal',
    suggestions: [0.6, 0.8, 1, 1.2, 1.4],
  },
  temperature: {
    title: 'Brew temperature',
    min: 80,
    max: 100,
    step: 1,
    mode: 'integer',
    suggestions: [86, 88, 90, 92, 94, 96, 98],
  },
  grindSetting: {
    title: 'Grind size',
    min: 0,
    max: 2500,
    step: 0.1,
    mode: 'decimal',
    modes: ['integer', 'decimal'],
    defaultValue: 20,
    suggestions: [],
  },
  dose: {
    title: 'Dose',
    min: 0,
    max: 30,
    step: 0.1,
    mode: 'decimal',
    defaultValue: 18,
    suggestions: [7, 16, 18, 20, 22, 24],
  },
  targetYield: {
    title: 'Yield',
    min: 10,
    max: 200,
    step: 0.1,
    mode: 'decimal',
    defaultValue: 36,
    suggestions: [14, 18, 20, 36, 40, 44, 48, 50],
  },
} as const satisfies Record<ValueAdjustmentKey, ValueAdjustmentDefinition>
