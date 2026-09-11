import type {
  DecaidAdvancedMachineSettings,
  DecaidMachineSettings,
  DecaidSettings,
  DecaidWorkflow,
  DisplayState,
  PresenceSettings,
} from '../../api/decaid/types'

// Defaults mirror Decaid's persisted defaults. Workflow fallbacks mirror the
// values Streamline presents when an older/partial response omits a field.
export const DEFAULT_REA_SETTINGS: DecaidSettings = {
  gatewayMode: 'disabled',
  logLevel: 'INFO',
  weightFlowMultiplier: 1,
  volumeFlowMultiplier: 0.3,
  hotWaterFlowMultiplier: 0.3,
  scalePowerMode: 'disconnect',
  blockOnNoScale: false,
  blockTareDuringShot: false,
  stopHotWaterAtWeight: true,
  preferredMachineId: null,
  preferredScaleId: null,
  automaticUpdateCheck: true,
  chargingMode: 'disabled',
  nightModeEnabled: false,
  nightModeSleepTime: 1320,
  nightModeMorningTime: 420,
  lowBatteryBrightnessLimit: true,
  keepAwake: true,
  simulatedDevices: [],
  themeMode: 'system',
}

export const DEFAULT_MACHINE_SETTINGS: DecaidMachineSettings = {
  usb: true,
  fan: 55,
  flushTemp: 90,
  flushFlow: 6,
  flushTimeout: 10,
  hotWaterFlow: 2.5,
  steamFlow: 0.9,
  tankTemp: 25,
  steamPurgeMode: 0,
}

export const DEFAULT_ADVANCED_MACHINE_SETTINGS: DecaidAdvancedMachineSettings = {
  heaterPh1Flow: 2,
  heaterPh2Flow: 4,
  heaterIdleTemp: 95,
  heaterPh2Timeout: 4,
  heaterVoltage: -1,
  refillKitSetting: 2,
}

export const DEFAULT_WORKFLOW_SETTINGS: Pick<DecaidWorkflow, 'steamSettings' | 'hotWaterData' | 'rinseData'> = {
  steamSettings: { targetTemperature: 150, duration: 60, flow: 0.9, stopAtTemperature: 0 },
  hotWaterData: { targetTemperature: 75, duration: 30, volume: 50, flow: 2.5 },
  rinseData: { targetTemperature: 90, duration: 10, flow: 6 },
}

export const DEFAULT_DISPLAY_SETTINGS: DisplayState = {
  brightness: 100,
  requestedBrightness: 100,
}

export const DEFAULT_PRESENCE_SETTINGS: PresenceSettings = {
  userPresenceEnabled: true,
  sleepTimeoutMinutes: 30,
  schedules: [],
  keepAwakeUntil: null,
}

export const SETTINGS_PROTOCOL = {
  steam: {
    enabledTemperatureMin: 135,
    // Match Decaid's steam form and Bestpresso's existing home-screen dial.
    temperatureMax: 170,
    duration: { min: 10, max: 120, step: 5 },
    flow: { min: 0.4, max: 2.5, step: 0.1 },
  },
  hotWater: {
    // Decaid accepts 35 °C and Bestpresso intentionally exposes that wider
    // range; Streamline's current UI starts at 50 °C.
    temperature: { min: 35, max: 95, step: 1 },
    volume: { min: 10, max: 500, step: 10 },
    duration: { min: 5, max: 120, step: 5 },
    flow: { min: 0.1, max: 8, step: 0.1 },
  },
  rinse: {
    temperature: { min: 5, max: 95, step: 5 },
    flow: { min: 1, max: 8, step: 1 },
    // Streamline deliberately leaves the upper bound open for long manual
    // rinses; zero is also a valid stored value.
    duration: { min: 0, step: 1 },
  },
  tankTemperature: { min: 10, max: 40, step: 1 },
  fan: { min: 0, max: 100, step: 1 },
  heater: {
    flow: { min: 0, max: 10, step: 0.1 },
    idleTemperature: { min: 0, max: 99, step: 1 },
    phase2Timeout: { min: 0, max: 60, step: 1 },
  },
  presenceTimeout: { min: 0, max: 240, step: 1 },
  brightness: { min: 0, max: 100, step: 1 },
} as const

export const normalizeReaSettings = (settings: DecaidSettings): DecaidSettings => ({
  ...DEFAULT_REA_SETTINGS,
  ...settings,
})

export const normalizeMachineSettings = (settings: DecaidMachineSettings): DecaidMachineSettings => ({
  ...DEFAULT_MACHINE_SETTINGS,
  ...settings,
})

export const normalizeAdvancedMachineSettings = (settings: DecaidAdvancedMachineSettings): DecaidAdvancedMachineSettings => ({
  ...DEFAULT_ADVANCED_MACHINE_SETTINGS,
  ...settings,
})

export const normalizeWorkflowSettings = (workflow: DecaidWorkflow): DecaidWorkflow => ({
  ...workflow,
  steamSettings: { ...DEFAULT_WORKFLOW_SETTINGS.steamSettings, ...workflow.steamSettings },
  hotWaterData: { ...DEFAULT_WORKFLOW_SETTINGS.hotWaterData, ...workflow.hotWaterData },
  rinseData: { ...DEFAULT_WORKFLOW_SETTINGS.rinseData, ...workflow.rinseData },
})

export const normalizeDisplaySettings = (display: DisplayState): DisplayState => {
  const requestedBrightness = display.requestedBrightness ?? display.brightness ?? DEFAULT_DISPLAY_SETTINGS.requestedBrightness
  return {
    ...DEFAULT_DISPLAY_SETTINGS,
    ...display,
    requestedBrightness,
  }
}

export const normalizePresenceSettings = (presence: PresenceSettings): PresenceSettings => ({
  ...DEFAULT_PRESENCE_SETTINGS,
  ...presence,
  schedules: presence.schedules ?? [],
})
