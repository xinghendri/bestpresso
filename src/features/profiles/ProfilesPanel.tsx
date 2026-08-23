import { useMemo, useState } from 'react'
import favoriteRemoveIcon from '../../assets/figma/favorite-remove.svg'
import favoriteReplaceIcon from '../../assets/figma/favorite-replace.svg'
import profileChevronIcon from '../../assets/figma/profile-chevron.svg'
import profileDetailEditIcon from '../../assets/figma/profile-detail-edit.svg'
import profileEditIcon from '../../assets/figma/profile-edit.svg'
import profileFavoriteIcon from '../../assets/figma/profile-favorite.svg'
import profileUseIcon from '../../assets/figma/profile-use.svg'
import profilesAddIcon from '../../assets/figma/profiles-add.svg'
import profilesBackIcon from '../../assets/figma/profiles-back.svg'
import profilesSearchIcon from '../../assets/figma/profiles-search.svg'
import type { BrewProfile, SettingFeedback } from '../../domain/brewing'
import { ProfileTargetChart } from '../brew/ProfileTargetChart'

const PROFILE_AUTHORING_ENABLED = false

interface ProfilesPanelProps {
  profiles: BrewProfile[]
  favoriteProfileSlots: Array<string | null>
  activeProfileId?: string
  feedback: SettingFeedback | null
  onSelectProfile: (profileId: string) => Promise<boolean>
  onSetFavoriteSlot: (profileId: string, slot: number) => Promise<boolean>
  onRemoveFavorite: (profileId: string) => Promise<boolean>
  onClose: () => void
  onAddProfile?: () => void
  onEditProfile?: (profileId: string) => void
}

export function ProfilesPanel({ profiles, favoriteProfileSlots, activeProfileId, feedback, onSelectProfile, onSetFavoriteSlot, onRemoveFavorite, onClose, onAddProfile, onEditProfile }: ProfilesPanelProps) {
  const [selectedProfileId, setSelectedProfileId] = useState(activeProfileId ?? profiles[0]?.id)
  const [activeCategory, setActiveCategory] = useState('All')
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [pendingProfileId, setPendingProfileId] = useState<string | null>(null)
  const [replacementProfileId, setReplacementProfileId] = useState<string | null>(null)

  const favoriteIds = favoriteProfileSlots.filter((id): id is string => Boolean(id))
  const favoriteIdSet = new Set(favoriteIds)
  const selectedProfile = profiles.find((profile) => profile.id === selectedProfileId)
    ?? profiles.find((profile) => profile.id === activeProfileId)
    ?? profiles[0]
  const availableCategories = useMemo(() => {
    const categories = profiles
      .map((profile) => profile.category)
      .filter((category): category is string => typeof category === 'string' && category.toLowerCase() !== 'popular')
    return ['All', ...Array.from(new Set(categories))]
  }, [profiles])
  const normalizedQuery = searchQuery.trim().toLowerCase()
  const visibleProfiles = profiles.filter((profile) => {
    const matchesCategory = activeCategory === 'All' || profile.category === activeCategory
    const searchText = `${profile.name} ${profile.category ?? ''} ${profile.description ?? ''}`.toLowerCase()
    return matchesCategory && (!normalizedQuery || searchText.includes(normalizedQuery))
  })
  const emptyFavoriteSlot = favoriteProfileSlots.findIndex((id) => !id)
  const replacingFavorite = replacementProfileId !== null

  const selectPreview = (profileId: string) => {
    setSelectedProfileId(profileId)
    setReplacementProfileId(null)
  }

  const selectCategory = (category: string) => {
    setActiveCategory(category)
    setReplacementProfileId(null)
    const firstProfile = category === 'All' ? profiles[0] : profiles.find((profile) => profile.category === category)
    if (firstProfile) setSelectedProfileId(firstProfile.id)
  }

  const applyProfile = async (profileId: string) => {
    setPendingProfileId(profileId)
    await onSelectProfile(profileId)
    setPendingProfileId(null)
  }

  const removeFavorite = async (profileId: string) => {
    setPendingProfileId(profileId)
    await onRemoveFavorite(profileId)
    setPendingProfileId(null)
  }

  const requestFavorite = async () => {
    if (!selectedProfile || favoriteIdSet.has(selectedProfile.id)) return
    if (replacementProfileId === selectedProfile.id) {
      setReplacementProfileId(null)
      return
    }
    if (emptyFavoriteSlot >= 0) {
      setPendingProfileId(selectedProfile.id)
      await onSetFavoriteSlot(selectedProfile.id, emptyFavoriteSlot)
      setPendingProfileId(null)
      return
    }
    setReplacementProfileId(selectedProfile.id)
  }

  const replaceFavorite = async (slot: number) => {
    if (!replacementProfileId) return
    setPendingProfileId(replacementProfileId)
    const replaced = await onSetFavoriteSlot(replacementProfileId, slot)
    setPendingProfileId(null)
    if (replaced) setReplacementProfileId(null)
  }

  return <main className="app-shell profiles-page">
    <header className="profiles-header">
      <div className="profiles-header__title">
        <button className="profiles-icon-button profiles-back" type="button" onClick={onClose} aria-label="Back to brewing"><img src={profilesBackIcon} alt="" /></button>
        <h1>Profiles</h1>
      </div>
      <div className="profiles-header__actions">
        {searchOpen && <label className="profiles-search-field"><span>Search profiles</span><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} autoFocus /></label>}
        <button className="profiles-icon-button profiles-search" type="button" aria-pressed={searchOpen} onClick={() => { setSearchOpen((current) => !current); if (searchOpen) setSearchQuery('') }} aria-label={searchOpen ? 'Close profile search' : 'Search profiles'}><img src={profilesSearchIcon} alt="" /></button>
        {/* Future profile creation is scaffolded but intentionally unavailable until Decaid authoring is designed. */}
        {PROFILE_AUTHORING_ENABLED && <button className="profiles-icon-button profiles-add" type="button" onClick={onAddProfile} aria-label="Add profile"><img src={profilesAddIcon} alt="" /></button>}
      </div>
    </header>

    {feedback?.status === 'error' && <div className="system-messages"><div className="system-message system-message--error" role="alert">{feedback.message}</div></div>}

    <section className="profiles-workspace">
      <aside className="favorites-panel" aria-label="Favorite profiles">
        <div className="favorites-panel__heading"><h2>Favorites</h2>{replacingFavorite && <span>Choose one to replace</span>}</div>
        <div className="favorites-list">
          {Array.from({ length: 5 }, (_, slot) => {
            const profileId = favoriteProfileSlots[slot]
            const profile = profiles.find((candidate) => candidate.id === profileId)
            if (!profile) return <div className="favorite-slot favorite-slot--empty" key={`empty-${slot}`}><span>Empty</span></div>
            const pending = pendingProfileId === profile.id || (replacementProfileId !== null && pendingProfileId === replacementProfileId)
            return <article className={`favorite-slot${replacingFavorite ? ' favorite-slot--replace' : ''}`} key={profile.id}>
              <button className="favorite-slot__profile" type="button" onClick={() => selectPreview(profile.id)} aria-label={`View ${profile.name}`}>
                <strong>{profile.name}</strong><img src={profileChevronIcon} alt="" />
              </button>
              {replacingFavorite
                ? <button className="favorite-slot__replace" type="button" disabled={pending} onClick={() => void replaceFavorite(slot)}><img src={favoriteReplaceIcon} alt="" /><span>{pending ? 'Replacing…' : 'Replace favorite'}</span></button>
                : <div className="favorite-slot__actions">
                  <button type="button" disabled={pending} onClick={() => void removeFavorite(profile.id)}><img src={favoriteRemoveIcon} alt="" /><span>{pending ? 'Removing…' : 'Remove'}</span></button>
                  {/* Future profile editing stays compiled behind the authoring flag for the next phase. */}
                  {PROFILE_AUTHORING_ENABLED && <button type="button" onClick={() => onEditProfile?.(profile.id)}><img src={profileEditIcon} alt="" /><span>Edit</span></button>}
                </div>}
            </article>
          })}
        </div>
      </aside>

      <section className="profile-browser">
        <nav className="profile-categories" aria-label="Profile categories">
          {availableCategories.map((category) => <button className={activeCategory === category ? 'profile-category profile-category--active' : 'profile-category'} type="button" key={category} aria-pressed={activeCategory === category} onClick={() => selectCategory(category)}>{category}</button>)}
        </nav>

        <div className="profile-catalog">
          <div className="profile-directory" role="listbox" aria-label="Profiles">
            {visibleProfiles.map((profile) => <button className={selectedProfile?.id === profile.id ? 'profile-directory__item profile-directory__item--selected' : 'profile-directory__item'} type="button" role="option" aria-selected={selectedProfile?.id === profile.id} key={profile.id} onClick={() => selectPreview(profile.id)}><strong>{profile.name}</strong>{profile.category && <small>{profile.category}</small>}</button>)}
            {!visibleProfiles.length && <p className="profile-directory__empty">No profiles found here.</p>}
          </div>

          {selectedProfile && <article className="profile-detail">
            <ProfileTargetChart profileName={selectedProfile.name} points={selectedProfile.targetPoints} variant="detail" />
            <div className="profile-detail__body">
              <div className="profile-detail__heading">
                <div><h2>{selectedProfile.name}</h2>{selectedProfile.category && <p>{selectedProfile.category}</p>}</div>
                <div className="profile-detail__actions">
                  <button type="button" disabled={pendingProfileId === selectedProfile.id} onClick={() => void applyProfile(selectedProfile.id)} aria-label={`Use ${selectedProfile.name}`} title="Use profile"><img src={profileUseIcon} alt="" /></button>
                  {/* Future editing is intentionally hidden while retaining its integration point. */}
                  {PROFILE_AUTHORING_ENABLED && <button type="button" onClick={() => onEditProfile?.(selectedProfile.id)} aria-label={`Edit ${selectedProfile.name}`} title="Edit profile"><img src={profileDetailEditIcon} alt="" /></button>}
                  {!favoriteIdSet.has(selectedProfile.id) && <button className={`profile-detail__favorite${replacementProfileId === selectedProfile.id ? ' profile-detail__favorite--replacing' : ''}`} type="button" disabled={pendingProfileId === selectedProfile.id} aria-pressed="false" onClick={() => void requestFavorite()} aria-label={replacementProfileId === selectedProfile.id ? 'Cancel favorite replacement' : `Favorite ${selectedProfile.name}`} title={replacementProfileId === selectedProfile.id ? 'Cancel replacement' : 'Add to favorites'}><img src={profileFavoriteIcon} alt="" /></button>}
                </div>
              </div>
              <p className="profile-detail__description">{selectedProfile.description ?? 'No description provided for this profile.'}</p>
            </div>
          </article>}
        </div>
      </section>
    </section>
  </main>
}
