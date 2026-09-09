import { useEffect, useState } from 'react'
import { callPluginEndpoint, getPluginSettings, getPlugins, getProfiles, updateProfile } from './api/decaid/client'
import { getDecaidSettingsUrl } from './api/decaid/config'
import type { DecaidProfileRecord } from './api/decaid/types'
import { AppShell } from './app/AppShell'
import { FullscreenPrompt } from './components/FullscreenPrompt/FullscreenPrompt'
import { InteractionSound } from './components/InteractionSound/InteractionSound'
import { ValueAdjustmentProvider } from './components/ValueAdjustment/ValueAdjustmentProvider'
import { useBrewingData } from './features/brew/useBrewingData'
import { ProfileBuilderScreen } from './features/profiles/ProfileBuilderScreen'
import { deduplicateImportedProfileTitle, type ParsedProfileImport, type VisualizerImportResult, visualizerCredentialsConfigured, visualizerImportedProfileId } from './features/profiles/profileImports'
import { ProfilesPanel } from './features/profiles/ProfilesPanel'
import { PreviousShotScreen } from './features/history/PreviousShotScreen'
import { DecaidUpdatePrompt } from './features/updates/DecaidUpdatePrompt'
import './styles/index.css'

type AppPage = 'home' | 'profiles' | 'previous-pull' | 'profile-builder'

const currentPage = (): AppPage => {
  const page = new URLSearchParams(window.location.search).get('page')
  return page === 'profiles' || page === 'previous-pull' || page === 'profile-builder' ? page : 'home'
}

const requestedProfileId = () => new URLSearchParams(window.location.search).get('profileId') ?? undefined

export default function App() {
  const data = useBrewingData()
  const [importedProfileRecord, setImportedProfileRecord] = useState<DecaidProfileRecord | undefined>()
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
    if (profileId) url.searchParams.set('profileId', profileId)
    else url.searchParams.delete('profileId')
    window.history.pushState({ page: nextPage }, '', url)
    setPage(nextPage)
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }

  const startProfileFromScratch = () => {
    setImportedProfileRecord(undefined)
    navigate('profile-builder')
  }

  const editImportedProfile = ({ profile, metadata }: ParsedProfileImport) => {
    setImportedProfileRecord({ profile, metadata, visibility: 'visible', isDefault: true })
    navigate('profile-builder')
  }

  const checkVisualizerImport = async () => {
    try {
      const [plugins, settings] = await Promise.all([getPlugins(), getPluginSettings('visualizer.reaplugin')])
      const plugin = plugins.find((candidate) => candidate.id === 'visualizer.reaplugin')
      if (!plugin?.loaded) return { ready: false, message: 'Enable the Visualizer plugin in Decaid settings first.' }
      if (!visualizerCredentialsConfigured(settings)) return { ready: false, message: 'Sign in to Visualizer in Decaid settings before importing a share code.' }
      return { ready: true }
    } catch {
      return { ready: false, message: 'Visualizer import is not available in this Decaid setup.' }
    }
  }

  const importFromVisualizer = async (shareCode: string) => {
    const before = await getProfiles()
    const beforeIds = new Set(before.map((record) => record.id).filter((id): id is string => Boolean(id)))
    const result = await callPluginEndpoint<VisualizerImportResult>('visualizer.reaplugin', 'import', { shareCode })
    if (result.success === false) throw new Error('Visualizer could not import that share code.')

    const after = await getProfiles()
    const reportedId = visualizerImportedProfileId(result)
    let imported = reportedId ? after.find((record) => record.id === reportedId) : undefined
    imported ??= after.find((record) => record.id && !beforeIds.has(record.id))
    if (!imported?.profile) throw new Error('The profile was imported, but Decaid did not return it to Bestpresso.')

    const existingTitles = before.map((record) => record.profile?.title).filter((title): title is string => Boolean(title?.trim()))
    const uniqueTitle = deduplicateImportedProfileTitle(imported.profile, existingTitles)
    if (uniqueTitle !== imported.profile.title && imported.id) {
      imported = await updateProfile(imported.id, { ...imported.profile, title: uniqueTitle }, imported.metadata)
    }

    const url = new URL(window.location.href)
    url.searchParams.set('page', 'profiles')
    if (imported.id) url.searchParams.set('profileId', imported.id)
    else url.searchParams.delete('profileId')
    window.location.assign(url)
  }

  let screen
  const profileId = requestedProfileId()
  const editingRecord = profileId ? data.profileRecordForEditing(profileId) : undefined
  const builderRecord = editingRecord ?? importedProfileRecord
  const creatingProfile = page === 'profile-builder' && !profileId
  if (page === 'profile-builder' && (creatingProfile || builderRecord) && !data.liveBrew.visible) screen = <ProfileBuilderScreen key={editingRecord?.id ?? (importedProfileRecord ? 'imported-profile' : 'new-profile')} initialRecord={builderRecord} existingTitles={data.allProfiles.map((profile) => profile.category ? `${profile.category} / ${profile.name}` : profile.name)} knownCategories={data.allProfiles.map((profile) => profile.category).filter((category): category is string => Boolean(category))} knownVersions={data.allProfiles.map((profile) => profile.version).filter((version): version is string => Boolean(version))} onSave={data.saveProfileDraft} onSaved={(created) => { setImportedProfileRecord(undefined); navigate('profiles', created.id) }} onClose={() => { setImportedProfileRecord(undefined); navigate('profiles', profileId) }} />
  else if (page === 'profiles' && !data.liveBrew.visible) screen = <ProfilesPanel profiles={data.allProfiles} favoriteProfileSlots={data.favoriteProfileSlots} activeProfileId={data.model.activeProfileId} initialProfileId={profileId} editingEnabled profileEditMode={(selectedProfileId) => data.profileRecordForEditing(selectedProfileId)?.isDefault === false ? 'edit' : 'copy'} feedback={data.settingFeedback} onSelectProfile={async (selectedProfileId) => { const selected = await data.selectProfile(selectedProfileId); if (selected) navigate('home'); return selected }} onSetFavoriteSlot={data.setFavoriteProfileSlot} onRemoveFavorite={data.removeFavoriteProfile} onStartProfile={startProfileFromScratch} onImportProfile={editImportedProfile} onCheckVisualizer={checkVisualizerImport} onImportVisualizer={importFromVisualizer} onOpenSettings={() => window.location.assign(getDecaidSettingsUrl())} onEditProfile={(selectedProfileId) => navigate('profile-builder', selectedProfileId)} onClose={() => navigate('home')} />
  else if (page === 'previous-pull' && !data.liveBrew.visible) screen = <PreviousShotScreen shots={data.shotHistory} initialShot={data.model.previousShot} status={data.previousShotStatus} onSelectShot={data.loadHistoryShot} onDismiss={() => navigate('home')} />
  else screen = <AppShell {...data} onSleep={data.toggleSleep} onWake={data.wakeMachine} onStopEspresso={data.stopEspresso} onSkipBrewStage={data.skipBrewStage} onStartDemoBrew={data.startDemoBrew} onPrepareCleaning={data.prepareCleaningSequence} onCancelCleaning={data.cancelCleaningSequence} onDismissLiveBrew={data.dismissLiveBrew} onSearchScale={data.searchForScale} onConnectScale={data.connectToScale} onDismissScalePicker={data.dismissScalePicker} onTareScale={data.tareConnectedScale} onUpdateMachineSetting={data.updateMachineSetting} onUpdateProfileSetting={data.updateProfileSetting} onSelectProfile={data.selectProfile} onOpenSettings={() => window.location.assign(getDecaidSettingsUrl())} onManageProfiles={() => navigate('profiles')} onOpenPreviousShot={() => navigate('previous-pull')} />

  const immersiveUiDeferred = data.liveBrew.visible || Boolean(data.utilityOperation) || data.sleepScreenActive
  return <ValueAdjustmentProvider><InteractionSound /><FullscreenPrompt defer={immersiveUiDeferred} />{screen}<DecaidUpdatePrompt defer={immersiveUiDeferred} /></ValueAdjustmentProvider>
}
