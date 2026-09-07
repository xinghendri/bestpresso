export type DecaidUpdatePhase = 'idle' | 'checking' | 'available' | 'downloading' | 'installing' | 'error'

export interface DecaidUpdateState {
  phase: DecaidUpdatePhase
  currentVersion: string
  latestVersion?: string | null
  releaseNotes?: string | null
  releaseUrl: string
  installable: boolean
  progress?: number | null
  error?: string | null
}

export interface DecaidUpdateCommand {
  command: 'check' | 'install'
}

export interface DecaidUpdateCommandError {
  error: string
  url?: string
}

export type DecaidUpdateMessage = DecaidUpdateState | DecaidUpdateCommandError

export function isUpdateState(message: DecaidUpdateMessage): message is DecaidUpdateState {
  return 'phase' in message
}

export function shouldPresentUpdate(state: DecaidUpdateState | null, dismissedVersion: string | null) {
  if (!state) return false
  const version = state.latestVersion || ''
  return (state.phase === 'available' || state.phase === 'downloading' || state.phase === 'installing')
    && (!dismissedVersion || dismissedVersion !== version)
}

export function updateProgressPercent(progress: number | null | undefined) {
  if (typeof progress !== 'number' || !Number.isFinite(progress)) return 0
  return Math.round(Math.min(1, Math.max(0, progress)) * 100)
}
