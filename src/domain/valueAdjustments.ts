import type { EditableMachineSetting, EditableProfileSetting } from './brewing'

export type BuilderValueAdjustmentKey =
  | 'builderPressure'
  | 'builderFlow'
  | 'builderTemperature'
  | 'builderDuration'
  | 'builderVolume'
  | 'builderYield'

export type BuiltInValueAdjustmentKey = EditableMachineSetting | EditableProfileSetting | BuilderValueAdjustmentKey
export type SettingsValueAdjustmentKey = `settings:${string}`
export type ValueAdjustmentKey = BuiltInValueAdjustmentKey | SettingsValueAdjustmentKey
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
    min: 35,
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
    min: 0,
    max: 1000,
    step: 0.1,
    mode: 'decimal',
    defaultValue: 36,
    suggestions: [14, 18, 20, 36, 40, 44, 48, 50],
  },
  builderPressure: {
    title: 'Pressure',
    min: 0,
    max: 15.9,
    step: 0.1,
    mode: 'decimal',
    suggestions: [2, 4, 6, 8, 9, 10, 12],
  },
  builderFlow: {
    title: 'Flow',
    min: 0,
    max: 15.9,
    step: 0.1,
    mode: 'decimal',
    suggestions: [1, 2, 3, 4, 6, 8],
  },
  builderTemperature: {
    title: 'Temperature',
    min: 0,
    max: 127.5,
    step: 0.5,
    mode: 'decimal',
    suggestions: [80, 85, 90, 93, 95, 100],
  },
  builderDuration: {
    title: 'Max time',
    min: 0,
    max: 127,
    step: 1,
    mode: 'integer',
    suggestions: [5, 10, 15, 20, 30, 40, 60],
  },
  builderVolume: {
    title: 'Move on volume',
    min: 0,
    max: 1023,
    step: 1,
    mode: 'integer',
    suggestions: [10, 20, 30, 40, 60, 100],
  },
  builderYield: {
    title: 'Move on yield',
    min: 0,
    max: 1000,
    step: 0.1,
    mode: 'decimal',
    suggestions: [10, 20, 30, 36, 40, 50],
  },
} as const satisfies Record<BuiltInValueAdjustmentKey, ValueAdjustmentDefinition>
