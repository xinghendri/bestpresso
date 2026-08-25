export type MachineReadiness = 'ready' | 'heating' | 'notHeating' | 'thirsty' | 'sleeping' | 'disconnected'
export type DataConnection = 'connecting' | 'connected' | 'fixture' | 'disconnected'
export type UtilityId = 'water' | 'steam' | 'scale' | 'tank'
export type ScaleConnectionStatus = 'connected' | 'disconnected' | 'searching'
export type EditableMachineSetting = 'hotWaterVolume' | 'hotWaterTemperature' | 'steamTemperature' | 'steamDuration' | 'steamFlow'
export type EditableProfileSetting = 'temperature' | 'grindSetting' | 'dose' | 'targetYield'
export type PreviousShotStatus = 'loading' | 'loaded' | 'empty' | 'error' | 'fixture'
export const WATER_TANK_CAPACITY_ML = 1207
export const WATER_TANK_SENSOR_FULL_MM = 43
export const WATER_TANK_LOW_LEVEL_ML = 450
export const WATER_TANK_WARNING_OFFSET_CLICKS = 5

export interface ScaleConnection {
  status: ScaleConnectionStatus
  id?: string
  name?: string
}

export interface AvailableScale {
  id: string
  name: string
}

export interface DisplayMetric {
  label: string
  value: string
  unit?: string
  subtext?: string
  subtextVariant?: 'plain' | 'pill'
  highlight?: boolean
}

export interface MachineUtility {
  id: UtilityId
  label: string
  metrics: DisplayMetric[]
  alert?: boolean
  warning?: boolean
  levelPercent?: number
}

export interface ProfileTargetPoint {
  elapsedMs: number
  pressure?: number
  flow?: number
}

export interface BrewProfile {
  id: string
  name: string
  category?: string
  description?: string
  temperature: string
  grindSetting: string
  dose: string
  targetYield: string
  targetPoints?: ProfileTargetPoint[]
  stepNames?: string[]
}

export interface PreviousShot {
  id?: string
  profileName: string
  timestamp?: string
  totalYield: string
  totalTime: string
  targetYield?: number
  points?: LiveShotPoint[]
}

export interface BrewingScreenModel {
  readiness: MachineReadiness
  activeProfileId?: string
  utilities: MachineUtility[]
  profiles: BrewProfile[]
  previousShot: PreviousShot | null
}

export interface SettingFeedback {
  status: 'saving' | 'saved' | 'error'
  message: string
}

export interface LiveShotPoint {
  elapsedMs: number
  pressure?: number
  flow?: number
  targetPressure?: number
  targetFlow?: number
  temperature?: number
  weight?: number
  weightFlow?: number
  stageIndex?: number
  stageName?: string
}

export interface LiveBrewState {
  active: boolean
  visible: boolean
  elapsedMs: number
  points: LiveShotPoint[]
}

export type UtilityOperationKind = 'hotWater' | 'steam' | 'flush'

export interface LiveUtilityOperation {
  kind: UtilityOperationKind
  elapsedMs: number
  flow: number
  temperature?: number
  volumeMl: number
  targetDuration?: number
  targetVolume?: number
}
