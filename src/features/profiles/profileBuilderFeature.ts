const enabledValue = (value: string | undefined) => value?.trim().toLowerCase() === 'true'

export function profileBuilderEnabled() {
  if (import.meta.env.PROD) return enabledValue(import.meta.env.VITE_ENABLE_PROFILE_BUILDER_RC)
  const queryEnabled = new URLSearchParams(window.location.search).get('enableProfileBuilder') === '1'
  return queryEnabled || enabledValue(import.meta.env.VITE_ENABLE_PROFILE_BUILDER)
}
