export interface DecaidProfileStep { temperature?: number }
export interface DecaidProfile { title?: string; steps?: DecaidProfileStep[]; target_weight?: number | null; dose_weight?: number | null }
export interface DecaidProfileRecord { id?: string; profile?: DecaidProfile; visibility?: string; metadata?: Record<string, unknown> | null }
export interface DecaidWorkflowContext { targetDoseWeight?: number | null; targetYield?: number | null; grinderSetting?: string | null }
export interface DecaidWorkflow {
  profile?: DecaidProfile
  context?: DecaidWorkflowContext
  steamSettings?: { targetTemperature?: number; duration?: number; flow?: number }
  hotWaterData?: { targetTemperature?: number; volume?: number }
}
export interface MachineSnapshot {
  state?: string | { state?: string; substate?: string }
  steamTemperature?: number
}
export interface ScaleSnapshot { status?: 'connected' | 'disconnected'; weight?: number; weightFlow?: number }
export interface WaterLevels { currentLevel?: number; refillLevel?: number }
export interface ShotMeasurement { machine?: { timestamp?: string; state?: { substate?: string } }; scale?: { weight?: number } }
export interface ShotRecord { id?: string; workflow?: DecaidWorkflow; measurements?: ShotMeasurement[]; annotations?: { actualYield?: number } }
export interface PaginatedShots { items?: ShotRecord[] }
