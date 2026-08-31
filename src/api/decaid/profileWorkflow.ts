import type { BrewProfile } from '../../domain/brewing.ts'
import { VALUE_ADJUSTMENTS } from '../../domain/valueAdjustments.ts'
import type { DecaidProfile, DecaidProfileRecord, DecaidWorkflowPatch } from './types.ts'

export const profileUsesStopAtWeight = (profile?: DecaidProfile) => {
  const targetWeight = Number(profile?.target_weight)
  return Number.isFinite(targetWeight) && targetWeight > 0
}

export const profileTargetYield = (profile?: DecaidProfile, configuredTarget: unknown = profile?.target_weight) => {
  const targetYield = Number(configuredTarget)
  return profileUsesStopAtWeight(profile) && Number.isFinite(targetYield) ? targetYield : undefined
}

export const workflowValuesForProfile = (record: DecaidProfileRecord, profile: BrewProfile) => {
  const profileTemperature = Number(profile.temperature)
  const profileDose = Number(profile.dose)
  const profileYield = Number(profile.targetYield)
  const profileGrindSetting = Number(profile.grindSetting)
  const temperature = Number.isFinite(profileTemperature) ? profileTemperature : Number(record.profile?.steps?.[0]?.temperature) || 92
  const dose = Number.isFinite(profileDose) ? profileDose : VALUE_ADJUSTMENTS.dose.defaultValue
  const grinderSetting = String(Number.isFinite(profileGrindSetting) ? profileGrindSetting : VALUE_ADJUSTMENTS.grindSetting.defaultValue)
  const usesStopAtWeight = profileUsesStopAtWeight(record.profile)
  const existingTargetWeight = Number(record.profile?.target_weight)
  const targetYield = usesStopAtWeight
    ? Number.isFinite(profileYield) ? profileYield : existingTargetWeight
    : null
  const workflowProfile = {
    ...record.profile,
    target_weight: targetYield,
    steps: record.profile?.steps?.map((step) => ({ ...step, temperature })) ?? [],
  }
  const patch: DecaidWorkflowPatch = {
    profile: workflowProfile,
    context: { grinderSetting, targetDoseWeight: dose, targetYield },
  }
  return {
    patch,
    metadata: {
      ...(record.metadata ?? {}),
      temperature,
      grinderSetting,
      targetDoseWeight: dose,
      targetYield,
    },
  }
}
