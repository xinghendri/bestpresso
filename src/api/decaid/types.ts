export interface DecaidProfileStep {
  temperature?: number
  seconds?: number
  duration?: number
  pressure?: number
  flow?: number
  pump?: string | { target?: string; pressure?: number; flow?: number }
  transition?: string | { type?: string; duration?: number; adaptive?: boolean }
  [key: string]: unknown
}
export interface DecaidProfile { title?: string; category?: string; description?: string; notes?: string; profile_notes?: string; steps?: DecaidProfileStep[]; target_weight?: number | null; dose_weight?: number | null }
export interface DecaidProfileRecord { id?: string; profile?: DecaidProfile; visibility?: string; metadata?: Record<string, unknown> | null; isDefault?: boolean }
export type FavoriteAssignments = Record<string, string | null>
export interface DecaidWorkflowContext { targetDoseWeight?: number | null; targetYield?: number | null; grinderSetting?: string | null }
export interface DecaidWorkflow {
  name?: string
  profile?: DecaidProfile
  context?: DecaidWorkflowContext
  steamSettings?: { targetTemperature?: number; duration?: number; flow?: number }
  hotWaterData?: { targetTemperature?: number; volume?: number }
}
export type DecaidWorkflowPatch = Partial<Pick<DecaidWorkflow, 'profile' | 'context' | 'steamSettings' | 'hotWaterData'>>
export interface MachineSnapshot {
  timestamp?: string
  state?: string | { state?: string; substate?: string }
  flow?: number
  pressure?: number
  targetFlow?: number
  targetPressure?: number
  mixTemperature?: number
  groupTemperature?: number
  targetMixTemperature?: number
  targetGroupTemperature?: number
  profileFrame?: number
  steamTemperature?: number
}
export interface ScaleSnapshot { status?: 'connected' | 'disconnected'; timestamp?: string; weight?: number; weightFlow?: number; timerValue?: number | null }
export interface DecaidDevice { id?: string; name?: string; state?: 'connected' | 'disconnected'; type?: 'machine' | 'scale' | 'sensor'; available?: boolean }
export interface DisplayState { brightness?: number; requestedBrightness?: number; platformSupported?: { brightness?: boolean; wakeLock?: boolean } }
export interface WaterLevels { currentLevel?: number; refillLevel?: number }
export interface TimeToReadyFrame { status?: string; remainingTimeMs?: number; currentTemp?: number; targetTemp?: number }
export interface ShotMeasurement {
  machine?: {
    timestamp?: string
    state?: { substate?: string }
    pressure?: number
    flow?: number
    targetPressure?: number
    targetFlow?: number
    mixTemperature?: number
    groupTemperature?: number
  }
  scale?: { weight?: number; weightFlow?: number }
}
export interface ShotRecord { id?: string; timestamp?: string; workflow?: DecaidWorkflow; measurements?: ShotMeasurement[]; annotations?: { actualYield?: number }; stopReason?: string | null }
