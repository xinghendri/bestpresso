import type { DecaidProfile } from '../../api/decaid/types'

export const CLEANING_PROFILE_START_STATE = 'espresso' as const

export const profileForCleaningShortcut = (profile: DecaidProfile): DecaidProfile => (
  profile.beverage_type?.trim().toLowerCase() === 'cleaning'
    ? profile
    : { ...profile, beverage_type: 'cleaning' }
)

export const isCleaningSequenceRun = (machineState: string | undefined, espressoExtraction: boolean, hasPreparedCleaningProfile: boolean) => (
  machineState === 'cleaning' || (hasPreparedCleaningProfile && espressoExtraction)
)
