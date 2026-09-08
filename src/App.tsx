import { useEffect, useState } from 'react'
import { getDecaidSettingsUrl } from './api/decaid/config'
import { AppShell } from './app/AppShell'
import { FullscreenPrompt } from './components/FullscreenPrompt/FullscreenPrompt'
import { InteractionSound } from './components/InteractionSound/InteractionSound'
import { ValueAdjustmentProvider } from './components/ValueAdjustment/ValueAdjustmentProvider'
import { useBrewingData } from './features/brew/useBrewingData'
import { ProfileBuilderScreen } from './features/profiles/ProfileBuilderScreen'
import { enableProfileBuilderForSession, profileBuilderEnabled } from './features/profiles/profileBuilderFeature'
import { ProfilesPanel } from './features/profiles/ProfilesPanel'
import { PreviousShotScreen } from './features/history/PreviousShotScreen'
import { DecaidUpdatePrompt } from './features/updates/DecaidUpdatePrompt'
import './styles/index.css'

type AppPage = 'home' | 'profiles' | 'previous-pull' | 'profile-builder'

const currentPage = (runtimeBuilderEnabled = profileBuilderEnabled()): AppPage => {
  const page = new URLSearchParams(window.location.search).get('page')
  if (page === 'profile-builder' && runtimeBuilderEnabled) return page
  return page === 'profiles' || page === 'previous-pull' ? page : 'home'
}

const requestedProfileId = () => new URLSearchParams(window.location.search).get('profileId') ?? undefined

export default function App() {
  const data = useBrewingData()
  const [builderEnabled, setBuilderEnabled] = useState(profileBuilderEnabled)
  const [, setPage] = useState(currentPage)
  const page = data.utilityOperation ? 'home' : currentPage(builderEnabled)
  const utilityOperationKind = data.utilityOperation?.kind

  useEffect(() => {
    const handlePopState = () => setPage(currentPage(builderEnabled))
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [builderEnabled])

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
    if (profileId) url.searchParams.set('profileId', profileId)
    else url.searchParams.delete('profileId')
    window.history.pushState({ page: nextPage }, '', url)
    setPage(nextPage)
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }

  let screen
  const profileId = requestedProfileId()
  const editingRecord = builderEnabled && profileId ? data.profileRecordForEditing(profileId) : undefined
  const creatingProfile = builderEnabled && page === 'profile-builder' && !profileId
  if (page === 'profile-builder' && (creatingProfile || editingRecord) && !data.liveBrew.visible) screen = <ProfileBuilderScreen key={editingRecord?.id ?? 'new-profile'} initialRecord={editingRecord} existingTitles={data.allProfiles.map((profile) => profile.category ? `${profile.category} / ${profile.name}` : profile.name)} onSave={data.saveProfileDraft} onSaved={(created) => navigate('profiles', created.id)} onClose={() => navigate('profiles', profileId)} />
  else if (page === 'profiles' && !data.liveBrew.visible) screen = <ProfilesPanel profiles={data.allProfiles} favoriteProfileSlots={data.favoriteProfileSlots} activeProfileId={data.model.activeProfileId} initialProfileId={profileId} editingEnabled={builderEnabled} profileEditMode={(selectedProfileId) => data.profileRecordForEditing(selectedProfileId)?.isDefault === false ? 'edit' : 'copy'} feedback={data.settingFeedback} onSelectProfile={async (selectedProfileId) => { const selected = await data.selectProfile(selectedProfileId); if (selected) navigate('home'); return selected }} onSetFavoriteSlot={data.setFavoriteProfileSlot} onRemoveFavorite={data.removeFavoriteProfile} onAddProfile={() => navigate('profile-builder')} onEditProfile={(selectedProfileId) => navigate('profile-builder', selectedProfileId)} onClose={() => navigate('home')} />
  else if (page === 'previous-pull' && !data.liveBrew.visible) screen = <PreviousShotScreen shots={data.shotHistory} initialShot={data.model.previousShot} status={data.previousShotStatus} onSelectShot={data.loadHistoryShot} onDismiss={() => navigate('home')} />
  else screen = <AppShell {...data} onSleep={data.toggleSleep} onWake={data.wakeMachine} onStopEspresso={data.stopEspresso} onSkipBrewStage={data.skipBrewStage} onStartDemoBrew={data.startDemoBrew} onPrepareCleaning={data.prepareCleaningSequence} onCancelCleaning={data.cancelCleaningSequence} onDismissLiveBrew={data.dismissLiveBrew} onSearchScale={data.searchForScale} onConnectScale={data.connectToScale} onDismissScalePicker={data.dismissScalePicker} onTareScale={data.tareConnectedScale} onUpdateMachineSetting={data.updateMachineSetting} onUpdateProfileSetting={data.updateProfileSetting} onSelectProfile={data.selectProfile} onOpenSettings={() => window.location.assign(getDecaidSettingsUrl())} onManageProfiles={() => navigate('profiles')} onOpenPreviousShot={() => navigate('previous-pull')} onUnlockProfileBuilder={() => { enableProfileBuilderForSession(); setBuilderEnabled(true) }} />

  const immersiveUiDeferred = data.liveBrew.visible || Boolean(data.utilityOperation) || data.sleepScreenActive
  return <ValueAdjustmentProvider><InteractionSound /><FullscreenPrompt defer={immersiveUiDeferred} />{screen}<DecaidUpdatePrompt defer={immersiveUiDeferred} /></ValueAdjustmentProvider>
}
