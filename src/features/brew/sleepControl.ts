import type { DecaidSettings, ScalePowerMode } from '../../api/decaid/types'

export const SLEEP_DISPLAY_BRIGHTNESS = 10

interface SleepControlApi {
  getSettings: () => Promise<DecaidSettings>
  setScalePowerMode: (mode: ScalePowerMode) => Promise<void>
  setMachineState: (state: 'sleeping') => Promise<void>
}

export async function sleepMachineAndConnectedScale(scaleConnected: boolean, api: SleepControlApi) {
  if (scaleConnected) {
    const settings = await api.getSettings()
    if (settings.scalePowerMode !== 'displayOff') await api.setScalePowerMode('displayOff')
  }

  await api.setMachineState('sleeping')
}
