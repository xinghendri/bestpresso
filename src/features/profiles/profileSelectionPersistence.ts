export const LAST_SELECTED_PROFILE_SHARED_KEY = 'bestpresso-last-selected-profile'
export const LAST_SELECTED_PROFILE_LOCAL_KEY = 'bestpresso.last-selected-profile-id.v1'

export const normalizeRememberedProfileId = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null

export const resolveRememberedProfileId = (availableProfileIds: string[], rememberedProfileId: string | null, currentProfileId?: string) => {
  if (rememberedProfileId && availableProfileIds.includes(rememberedProfileId)) return rememberedProfileId
  return currentProfileId && availableProfileIds.includes(currentProfileId) ? currentProfileId : null
}
