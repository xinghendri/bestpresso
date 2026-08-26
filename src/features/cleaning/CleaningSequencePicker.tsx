import { useRef, useState, type CSSProperties } from 'react'
import brewAction from '../../assets/figma/brew-action.svg'
import cleaningProfile from '../../assets/figma/cleaning-profile.svg'
import cleaningProfileSelected from '../../assets/figma/cleaning-profile-selected.svg'
import type { BrewProfile } from '../../domain/brewing'

interface CleaningSequencePickerProps {
  profiles: BrewProfile[]
  pending: boolean
  onStart: (profileId: string) => Promise<boolean>
  onDismiss: () => void
}

export function CleaningSequencePicker({ profiles, pending, onStart, onDismiss }: CleaningSequencePickerProps) {
  const visibleProfiles = profiles.slice(0, 8)
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(visibleProfiles.length === 1 ? visibleProfiles[0].id : null)
  const [starting, setStarting] = useState(false)
  const startInFlight = useRef(false)
  const interactionLocked = pending || starting
  const columns = Math.max(1, Math.min(4, visibleProfiles.length || 2))
  const rows = Math.max(1, Math.ceil(visibleProfiles.length / columns))
  const panelStyle = {
    '--cleaning-picker-columns': columns,
    width: `${(columns * 223) + ((columns - 1) * 15) + 48}px`,
    height: `${97 + 25 + (rows * 133) + ((rows - 1) * 15) + 26}px`,
  } as CSSProperties

  const startSelected = async () => {
    if (!selectedProfileId || interactionLocked || startInFlight.current) return
    startInFlight.current = true
    setStarting(true)
    try {
      if (await onStart(selectedProfileId)) onDismiss()
    } finally {
      startInFlight.current = false
      setStarting(false)
    }
  }

  return <div className="cleaning-picker-overlay" role="presentation" onPointerDown={(event) => {
    if (event.target === event.currentTarget && !interactionLocked) onDismiss()
  }}>
    <section className="cleaning-picker" style={panelStyle} role="dialog" aria-modal="true" aria-labelledby="cleaning-picker-title" aria-busy={interactionLocked}>
      <header className="cleaning-picker__header">
        <div>
          <h2 id="cleaning-picker-title">Cleaning</h2>
          <p>Select a sequence and press <button className="cleaning-picker__brew" type="button" aria-label="Start selected cleaning sequence" disabled={!selectedProfileId || interactionLocked} onClick={() => void startSelected()}><img src={brewAction} alt="" /></button></p>
        </div>
        <button className="cleaning-picker__close" type="button" disabled={interactionLocked} onClick={onDismiss}>Close</button>
      </header>
      <div className="cleaning-picker__profiles">
        {visibleProfiles.map((profile) => {
          const selected = selectedProfileId === profile.id
          return <button
            className={`cleaning-picker-card${selected ? ' cleaning-picker-card--selected' : ''}`}
            key={profile.id}
            type="button"
            disabled={interactionLocked}
            aria-pressed={selected}
            onClick={() => setSelectedProfileId(profile.id)}
          >
            <img src={selected ? cleaningProfileSelected : cleaningProfile} alt="" />
            <strong>{profile.name}</strong>
          </button>
        })}
        {!visibleProfiles.length && <p className="cleaning-picker__empty">No cleaning sequences are available yet.</p>}
      </div>
    </section>
    {interactionLocked && <div className="cleaning-start-loader" role="status" aria-live="assertive" aria-label="Loading selected cleaning sequence">
      <span className="cleaning-start-loader__spinner" aria-hidden="true" />
      <strong>Loading cleaning sequence…</strong>
      <small>Please wait while the profile is sent to the machine.</small>
    </div>}
  </div>
}
