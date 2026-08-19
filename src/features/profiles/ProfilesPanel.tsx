import logo from '../../assets/figma/decent-logo.png'
import type { BrewProfile } from '../../domain/brewing'

export function ProfilesPanel({ profiles, favoriteProfileIds, onClose }: { profiles: BrewProfile[]; favoriteProfileIds: string[]; onClose: () => void }) {
  const favoriteSlots = new Map(favoriteProfileIds.map((id, index) => [id, index + 1]))
  return <main className="app-shell profiles-page">
    <header className="subpage-header">
      <img className="logo" src={logo} alt="decent" />
      <button type="button" className="subpage-done" onClick={onClose}>Done</button>
    </header>
    <section className="profiles-page__content">
      <div className="profiles-page__title"><p>Profiles</p><h1>All brewing profiles</h1><span>{profiles.length} available · {favoriteProfileIds.length} favorites</span></div>
      <div className="profile-list">
        {profiles.map((profile) => {
          const slot = favoriteSlots.get(profile.id)
          return <article className="profile-list__item" key={profile.id}>
            <div><h2>{profile.name}</h2>{slot && <span>Favorite {slot}</span>}</div>
            <dl>
              <div><dt>Temp.</dt><dd>{profile.temperature}°</dd></div>
              <div><dt>Grind</dt><dd>{profile.grindSetting}</dd></div>
              <div><dt>Dose</dt><dd>{profile.dose}g</dd></div>
              <div><dt>Yield</dt><dd>{profile.targetYield}g</dd></div>
            </dl>
          </article>
        })}
      </div>
    </section>
  </main>
}
