import type { DecaidMachineSettings, DecaidWorkflow, DecaidWorkflowPatch } from '../../api/decaid/types'

const equivalent = (left: number | undefined, right: number) => left !== undefined && Math.abs(left - right) < 0.001

const usableMachineValue = (value: number | undefined) => (
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined
)

export function rinseWorkflowPatchFromMachineSettings(
  workflow: DecaidWorkflow,
  settings: DecaidMachineSettings,
): DecaidWorkflowPatch | null {
  const targetTemperature = usableMachineValue(settings.flushTemp)
  const duration = usableMachineValue(settings.flushTimeout)
  const flow = usableMachineValue(settings.flushFlow)
  const current = workflow.rinseData
  const changed = (
    (targetTemperature !== undefined && !equivalent(current?.targetTemperature, targetTemperature))
    || (duration !== undefined && !equivalent(current?.duration, duration))
    || (flow !== undefined && !equivalent(current?.flow, flow))
  )
  if (!changed) return null

  return {
    rinseData: {
      ...current,
      ...(targetTemperature === undefined ? {} : { targetTemperature }),
      ...(duration === undefined ? {} : { duration }),
      ...(flow === undefined ? {} : { flow }),
    },
  }
}
