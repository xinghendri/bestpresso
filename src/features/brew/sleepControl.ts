import type { MachineReadiness } from '../../domain/brewing'

export const SLEEP_DISPLAY_BRIGHTNESS = 7

interface SleepControlApi {
  setMachineState: (state: 'sleeping') => Promise<void>
}

export async function sleepMachineWithConfiguredScalePolicy(api: SleepControlApi) {
  await api.setMachineState('sleeping')
}

export const shouldRunBackgroundScaleScan = (
  preferredScaleId: string | null | undefined,
  scaleConnected: boolean,
  readiness: MachineReadiness | null,
) => Boolean(preferredScaleId) && !scaleConnected && readiness !== 'sleeping'
