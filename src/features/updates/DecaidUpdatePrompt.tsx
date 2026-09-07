import { useEffect, useRef, useState } from 'react'
import { subscribeWithCommands, type CommandSocketSubscription } from '../../api/decaid/socket'
import { isUpdateState, shouldPresentUpdate, updateProgressPercent, type DecaidUpdateCommand, type DecaidUpdateMessage, type DecaidUpdateState } from './decaidUpdate'

const dismissalKey = 'bestpresso.decaid-update-dismissed'

function dismissedVersion() {
  try { return window.sessionStorage.getItem(dismissalKey) }
  catch { return null }
}

interface DecaidUpdatePromptProps {
  defer?: boolean
}

export function DecaidUpdatePrompt({ defer = false }: DecaidUpdatePromptProps) {
  const channel = useRef<CommandSocketSubscription<DecaidUpdateCommand> | null>(null)
  const installRequested = useRef(false)
  const [state, setState] = useState<DecaidUpdateState | null>(null)
  const [dismissed, setDismissed] = useState(dismissedVersion)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    channel.current = subscribeWithCommands<DecaidUpdateMessage, DecaidUpdateCommand>(
      '/update',
      (message) => {
        if (!isUpdateState(message)) {
          if (installRequested.current) setActionError(message.error)
          return
        }
        setState(message)
        if (message.phase === 'downloading' || message.phase === 'installing') installRequested.current = true
        if (message.phase === 'error' && installRequested.current) setActionError(message.error || 'The update could not be started.')
      },
      () => {},
      (send) => { send({ command: 'check' }) },
    )
    return () => {
      channel.current?.close()
      channel.current = null
    }
  }, [])

  const busy = state?.phase === 'downloading' || state?.phase === 'installing'
  if ((defer && !busy) || (!shouldPresentUpdate(state, dismissed) && !actionError)) return null

  const version = state?.latestVersion || 'a newer version'
  const progress = updateProgressPercent(state?.progress)

  const dismiss = () => {
    const versionToDismiss = state?.latestVersion || ''
    try { window.sessionStorage.setItem(dismissalKey, versionToDismiss) } catch { /* session persistence is optional */ }
    setDismissed(versionToDismiss)
    setActionError(null)
  }

  const update = () => {
    if (!state) return
    setActionError(null)
    installRequested.current = true
    if (!state.installable) {
      window.location.assign(state.releaseUrl)
      return
    }
    if (!channel.current?.send({ command: 'install' })) {
      setActionError('Bestpresso lost its connection to Decaid. Try again in a moment.')
    }
  }

  return <div className="decaid-update-overlay" role="presentation">
    <section className="decaid-update" role="dialog" aria-modal="true" aria-labelledby="decaid-update-title" aria-describedby="decaid-update-description" aria-busy={busy}>
      <div className="decaid-update__mark" aria-hidden="true">↑</div>
      <div className="decaid-update__copy">
        <h2 id="decaid-update-title">Decaid update available</h2>
        <p id="decaid-update-description">Version {version} is ready with the latest improvements and fixes.</p>
        {state?.currentVersion && <small>Installed version {state.currentVersion}</small>}
        {actionError && <p className="decaid-update__error" role="alert">{actionError}</p>}
        {state?.phase === 'downloading' && <div className="decaid-update__progress" aria-label={`Downloading update, ${progress}% complete`}><span style={{ width: `${progress}%` }} /></div>}
        {state?.phase === 'downloading' && <small>Downloading… {progress}%</small>}
        {state?.phase === 'installing' && <small>Opening the installer…</small>}
      </div>
      <div className="decaid-update__actions">
        <button className="decaid-update__later" type="button" disabled={busy} onClick={dismiss}>{actionError ? 'Close' : 'Later'}</button>
        {!actionError && <button className="decaid-update__primary" type="button" disabled={busy} onClick={update}>{busy ? 'Updating…' : state?.installable ? 'Update Decaid' : 'View download'}</button>}
      </div>
    </section>
  </div>
}
