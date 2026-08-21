export type MachineReadiness = 'ready' | 'heating' | 'notHeating' | 'sleeping' | 'disconnected'
export type DataConnection = 'connecting' | 'connected' | 'fixture' | 'disconnected'
export type UtilityId = 'water' | 'steam' | 'scale' | 'tank'
export type ScaleConnectionStatus = 'connected' | 'disconnected' | 'searching'
export type EditableMachineSetting = 'hotWaterVolume' | 'hotWaterTemperature' | 'steamTemperature' | 'steamDuration' | 'steamFlow'
export type EditableProfileSetting = 'temperature' | 'grindSetting' | 'dose' | 'targetYield'
export type PreviousShotStatus = 'loading' | 'loaded' | 'empty' | 'error' | 'fixture'
export const WATER_TANK_CAPACITY_ML = 1277
export const WATER_TANK_SENSOR_FULL_MM = 45
export const WATER_TANK_LOW_LEVEL_ML = 450

export interface ScaleConnection {
  status: ScaleConnectionStatus
  name?: string
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
  temperature: string
  grindSetting: string
  dose: string
  targetYield: string
  targetPoints?: ProfileTargetPoint[]
}

export interface PreviousShot {
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
}

export interface LiveBrewState {
  active: boolean
  visible: boolean
  elapsedMs: number
  points: LiveShotPoint[]
}
