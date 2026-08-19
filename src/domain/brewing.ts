export type MachineReadiness = 'ready' | 'heating' | 'sleeping' | 'disconnected'
export type DataConnection = 'connecting' | 'connected' | 'fixture' | 'disconnected'
export type UtilityId = 'water' | 'steam' | 'scale' | 'tank'

export interface DisplayMetric {
  label: string
  value: string
  unit?: string
  highlight?: boolean
}

export interface MachineUtility {
  id: UtilityId
  label: string
  metrics: DisplayMetric[]
}

export interface BrewProfile {
  id: string
  name: string
  temperature: string
  grindSetting: string
  dose: string
  targetYield: string
}

export interface PreviousShot {
  profileName: string
  totalYield: string
  totalTime: string
}

export interface BrewingScreenModel {
  readiness: MachineReadiness
  activeProfileId?: string
  utilities: MachineUtility[]
  profiles: BrewProfile[]
  previousShot: PreviousShot
}
