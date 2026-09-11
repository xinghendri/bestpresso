export interface DecaidProfileStep {
  name?: string
  temperature?: number
  seconds?: number
  duration?: number
  volume?: number
  weight?: number | null
  pressure?: number
  flow?: number
  pump?: string | { target?: string; pressure?: number; flow?: number }
  transition?: string | { type?: string; duration?: number; adaptive?: boolean }
  sensor?: 'coffee' | 'water' | string
  exit?: { type?: 'pressure' | 'flow' | string; condition?: 'over' | 'under' | string; value?: number } | null
  limiter?: { value?: number; range?: number } | null
  [key: string]: unknown
}
export interface DecaidProfile {
  version?: string | null
  title?: string
  category?: string
  beverage_type?: 'espresso' | 'calibrate' | 'cleaning' | 'manual' | 'pourover' | string
  description?: string
  notes?: string
  author?: string
  profile_notes?: string
  steps?: DecaidProfileStep[]
  target_weight?: number | null
  target_volume?: number | null
  target_volume_count_start?: number
  tank_temperature?: number
  dose_weight?: number | null
  [key: string]: unknown
}
export interface DecaidProfileRecord { id?: string; parentId?: string | null; profile?: DecaidProfile; visibility?: string; metadata?: Record<string, unknown> | null; isDefault?: boolean }
export type FavoriteAssignments = Record<string, string | null>
export interface DecaidWorkflowContext { targetDoseWeight?: number | null; targetYield?: number | null; grinderSetting?: string | null }
export interface DecaidWorkflow {
  name?: string
  profile?: DecaidProfile
  context?: DecaidWorkflowContext
  steamSettings?: { targetTemperature?: number; duration?: number; flow?: number; stopAtTemperature?: number }
  hotWaterData?: { targetTemperature?: number; duration?: number; volume?: number; flow?: number }
  rinseData?: { targetTemperature?: number; duration?: number; flow?: number }
}
export type DecaidWorkflowPatch = Partial<Pick<DecaidWorkflow, 'profile' | 'context' | 'steamSettings' | 'hotWaterData' | 'rinseData'>>
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
export type ScalePowerMode = 'disabled' | 'displayOff' | 'disconnect'
export type ChargingMode = 'disabled' | 'longevity' | 'balanced' | 'highAvailability'
export type GatewayMode = 'disabled' | 'full' | 'tracking'
export type DecaidThemeMode = 'system' | 'light' | 'dark'
export interface DecaidSettings {
  gatewayMode?: GatewayMode
  webUiPath?: string | null
  logLevel?: string
  weightFlowMultiplier?: number
  volumeFlowMultiplier?: number
  hotWaterFlowMultiplier?: number
  scalePowerMode?: ScalePowerMode
  blockOnNoScale?: boolean
  blockTareDuringShot?: boolean
  stopHotWaterAtWeight?: boolean
  preferredMachineId?: string | null
  preferredScaleId?: string | null
  defaultSkinId?: string | null
  automaticUpdateCheck?: boolean
  chargingMode?: ChargingMode
  nightModeEnabled?: boolean
  nightModeSleepTime?: number
  nightModeMorningTime?: number
  lowBatteryBrightnessLimit?: boolean
  keepAwake?: boolean
  simulatedDevices?: ('machine' | 'scale' | 'sensor' | 'bengle')[]
  themeMode?: DecaidThemeMode
}
export interface DecaidMachineSettings {
  usb?: boolean
  fan?: number
  flushTemp?: number
  flushTimeout?: number
  flushFlow?: number
  hotWaterFlow?: number
  steamFlow?: number
  tankTemp?: number
  steamPurgeMode?: number
}
export interface DecaidAdvancedMachineSettings {
  heaterPh1Flow?: number
  heaterPh2Flow?: number
  heaterIdleTemp?: number
  heaterPh2Timeout?: number
  heaterVoltage?: 120 | 230 | -1
  refillKitSetting?: 0 | 1 | 2
}
export interface DisplayState {
  wakeLockEnabled?: boolean
  wakeLockOverride?: boolean
  brightness?: number
  requestedBrightness?: number
  lowBatteryBrightnessActive?: boolean
  platformSupported?: { brightness?: boolean; wakeLock?: boolean }
}
export interface WakeSchedule {
  id?: string
  hour?: number
  minute?: number
  time?: string
  daysOfWeek?: number[]
  enabled?: boolean
  keepAwakeFor?: number | null
}
export interface PresenceSettings {
  userPresenceEnabled?: boolean
  sleepTimeoutMinutes?: number
  schedules?: WakeSchedule[]
  keepAwakeUntil?: string | null
}
export interface DecaidInfo {
  version?: string
  buildNumber?: string
  fullVersion?: string
  commitShort?: string
  branch?: string
  localIp?: string
}
export interface MachineCapabilities { capabilities?: string[]; [key: string]: unknown }
export interface DecentAccountStatus { loggedIn: boolean; username?: string | null }
export interface WaterLevels { currentLevel?: number; refillLevel?: number }
export interface TimeToReadyFrame { status?: string; remainingTimeMs?: number; currentTemp?: number; targetTemp?: number }
export interface ShotMeasurement {
  machine?: {
    timestamp?: string
    state?: { substate?: string }
    profileFrame?: number
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
export interface PaginatedShots { items: ShotRecord[]; total: number; limit: number; offset: number }
