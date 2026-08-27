export const CLEANING_PROFILE_START_STATE = 'espresso' as const

export const isCleaningSequenceRun = (machineState: string | undefined, espressoExtraction: boolean, hasPreparedCleaningProfile: boolean) => (
  machineState === 'cleaning' || (hasPreparedCleaningProfile && espressoExtraction)
)
