import { useState } from 'react'
import logo from '../../assets/figma/decent-logo.png'
import type { BrewProfile, SettingFeedback } from '../../domain/brewing'

interface ProfilesPanelProps {
  profiles: BrewProfile[]
  favoriteProfileIds: string[]
  activeProfileId?: string
  feedback: SettingFeedback | null
  onSelectProfile: (profileId: string) => Promise<boolean>
  onSetFavoriteSlot: (profileId: string, slot: number) => Promise<boolean>
  onClose: () => void
}

export function ProfilesPanel({ profiles, favoriteProfileIds, activeProfileId, feedback, onSelectProfile, onSetFavoriteSlot, onClose }: ProfilesPanelProps) {
  const [favoritePickerId, setFavoritePickerId] = useState<string | null>(null)
  const [pendingProfileId, setPendingProfileId] = useState<string | null>(null)
  const favoriteSlots = new Map(favoriteProfileIds.map((id, index) => [id, index + 1]))

  const selectProfile = async (profileId: string) => {
    setPendingProfileId(profileId)
    await onSelectProfile(profileId)
    setPendingProfileId(null)
  }

  const setFavoriteSlot = async (profileId: string, slot: number) => {
    setPendingProfileId(profileId)
    const saved = await onSetFavoriteSlot(profileId, slot)
    setPendingProfileId(null)
    if (saved) setFavoritePickerId(null)
  }

  return <main className="app-shell profiles-page">
    <header className="subpage-header">
      <img className="logo" src={logo} alt="decent" />
      <button type="button" className="subpage-done" onClick={onClose}>Done</button>
    </header>
    {feedback && <div className="system-messages"><div className={`system-message system-message--${feedback.status}`} role={feedback.status === 'error' ? 'alert' : 'status'}>{feedback.message}</div></div>}
    <section className="profiles-page__content">
      <div className="profiles-page__title"><p>Profiles</p><h1>Select your next brew</h1><span>{profiles.length} available · {favoriteProfileIds.length} favorites</span></div>
      <div className="profile-list">
        {profiles.map((profile) => {
          const slot = favoriteSlots.get(profile.id)
          const selected = profile.id === activeProfileId
          const pending = profile.id === pendingProfileId
          const choosingSlot = favoritePickerId === profile.id
          return <article className={`profile-list__item${selected ? ' profile-list__item--selected' : ''}${choosingSlot ? ' profile-list__item--choosing-slot' : ''}`} key={profile.id}>
            <div className="profile-list__heading"><h2>{profile.name}</h2><div className="profile-list__badges">{selected && <span className="profile-list__selected-badge">Selected</span>}{slot && <span>Favorite {slot}</span>}</div></div>
            <dl>
              <div><dt>Temp.</dt><dd>{profile.temperature}°</dd></div>
              <div><dt>Grind</dt><dd>{profile.grindSetting}</dd></div>
              <div><dt>Dose</dt><dd>{profile.dose}g</dd></div>
              <div><dt>Yield</dt><dd>{profile.targetYield}g</dd></div>
            </dl>
            <div className="profile-list__actions">
              <button className="profile-list__select" type="button" disabled={selected || pending} onClick={() => void selectProfile(profile.id)}>{pending ? 'Applying…' : selected ? 'Selected' : 'Use profile'}</button>
              <button className="profile-list__favorite" type="button" aria-expanded={choosingSlot} onClick={() => setFavoritePickerId((current) => current === profile.id ? null : profile.id)}>{slot ? `Move Favorite ${slot}` : 'Set favorite'}</button>
            </div>
            {choosingSlot && <div className="profile-list__slot-picker" aria-label={`Favorite slot for ${profile.name}`}><span>{slot ? 'Move or swap with' : 'Replace favorite'}</span>{favoriteProfileIds.map((favoriteId, index) => <button key={favoriteId} type="button" disabled={pending || slot === index + 1} aria-label={`Favorite ${index + 1}: ${profiles.find((candidate) => candidate.id === favoriteId)?.name ?? 'Empty'}`} onClick={() => void setFavoriteSlot(profile.id, index)}>{index + 1}</button>)}</div>}
          </article>
        })}
      </div>
    </section>
  </main>
}
