import { useEffect, useState } from 'react'
import { getDecaidSettingsUrl } from './api/decaid/config'
import { AppShell } from './app/AppShell'
import { InteractionSound } from './components/InteractionSound/InteractionSound'
import { ValueAdjustmentProvider } from './components/ValueAdjustment/ValueAdjustmentProvider'
import { useBrewingData } from './features/brew/useBrewingData'
import { ProfilesPanel } from './features/profiles/ProfilesPanel'
import { ProfileBuilderScreen } from './features/profiles/ProfileBuilderScreen'
import { PreviousShotScreen } from './features/history/PreviousShotScreen'
import './styles/index.css'

type AppPage = 'home' | 'profiles' | 'profile-builder' | 'previous-pull'

const currentPage = (): AppPage => {
  const page = new URLSearchParams(window.location.search).get('page')
  return page === 'profiles' || page === 'profile-builder' || page === 'previous-pull' ? page : 'home'
}

const editingProfileId = () => new URLSearchParams(window.location.search).get('profileId') ?? undefined

export default function App() {
  const data = useBrewingData()
  const [, setPage] = useState(currentPage)
  const page = data.utilityOperation ? 'home' : currentPage()
  const utilityOperationKind = data.utilityOperation?.kind

  useEffect(() => {
    const handlePopState = () => setPage(currentPage())
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    if (!utilityOperationKind || currentPage() === 'home') return
    const url = new URL(window.location.href)
    url.searchParams.delete('page')
    window.history.replaceState({ page: 'home' }, '', url)
  }, [utilityOperationKind])

  const navigate = (nextPage: AppPage, profileId?: string) => {
    const url = new URL(window.location.href)
    if (nextPage === 'home') url.searchParams.delete('page')
    else url.searchParams.set('page', nextPage)
    if (nextPage === 'profile-builder' && profileId) url.searchParams.set('profileId', profileId)
    else url.searchParams.delete('profileId')
    window.history.pushState({ page: nextPage }, '', url)
    setPage(nextPage)
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }

  let screen
  if (page === 'profiles' && !data.liveBrew.visible) screen = <ProfilesPanel profiles={data.allProfiles} favoriteProfileSlots={data.favoriteProfileSlots} activeProfileId={data.model.activeProfileId} feedback={data.settingFeedback} onSelectProfile={async (profileId) => { const selected = await data.selectProfile(profileId); if (selected) navigate('home'); return selected }} onSetFavoriteSlot={data.setFavoriteProfileSlot} onRemoveFavorite={data.removeFavoriteProfile} onClose={() => navigate('home')} onAddProfile={() => navigate('profile-builder')} onEditProfile={(profileId) => navigate('profile-builder', profileId)} />
  else if (page === 'profile-builder' && !data.liveBrew.visible) screen = <ProfileBuilderScreen initialRecord={editingProfileId() ? data.profileRecordForEditing(editingProfileId()!) : undefined} existingTitles={data.allProfiles.map((profile) => profile.category ? `${profile.category} / ${profile.name}` : profile.name)} onSave={data.saveProfileCopy} onClose={() => navigate('profiles')} />
  else if (page === 'previous-pull' && !data.liveBrew.visible) screen = <PreviousShotScreen shots={data.shotHistory} initialShot={data.model.previousShot} status={data.previousShotStatus} onSelectShot={data.loadHistoryShot} onDismiss={() => navigate('home')} />
  else screen = <AppShell {...data} onSleep={data.toggleSleep} onWake={data.wakeMachine} onStopEspresso={data.stopEspresso} onSkipBrewStage={data.skipBrewStage} onPrepareCleaning={data.prepareCleaningSequence} onCancelCleaning={data.cancelCleaningSequence} onDismissLiveBrew={data.dismissLiveBrew} onSearchScale={data.searchForScale} onConnectScale={data.connectToScale} onDismissScalePicker={data.dismissScalePicker} onTareScale={data.tareConnectedScale} onUpdateMachineSetting={data.updateMachineSetting} onUpdateProfileSetting={data.updateProfileSetting} onSelectProfile={data.selectProfile} onOpenSettings={() => window.location.assign(getDecaidSettingsUrl())} onManageProfiles={() => navigate('profiles')} onOpenPreviousShot={() => navigate('previous-pull')} />

  return <ValueAdjustmentProvider><InteractionSound />{screen}</ValueAdjustmentProvider>
}
