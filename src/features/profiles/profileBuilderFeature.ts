const enabledValue = (value: string | undefined) => value?.trim().toLowerCase() === 'true'

const profileBuilderSessionKey = 'bestpresso.profile-builder-session.v1'

const sessionEnabled = () => {
  try {
    return window.sessionStorage.getItem(profileBuilderSessionKey) === 'true'
  } catch {
    return false
  }
}

export function profileBuilderEnabled() {
  if (sessionEnabled()) return true
  if (import.meta.env.PROD) return enabledValue(import.meta.env.VITE_ENABLE_PROFILE_BUILDER_RC)
  const queryEnabled = new URLSearchParams(window.location.search).get('enableProfileBuilder') === '1'
  return queryEnabled || enabledValue(import.meta.env.VITE_ENABLE_PROFILE_BUILDER)
}

export function enableProfileBuilderForSession() {
  try {
    window.sessionStorage.setItem(profileBuilderSessionKey, 'true')
  } catch {
    // Storage is optional; App state still enables the editor for this run.
  }
}
