import { useState } from 'react'
import cleaning from '../assets/figma/cleaning-profile.svg'
import logo from '../assets/figma/decent-logo.png'
import settings from '../assets/figma/settings.svg'
import sleep from '../assets/figma/sleep.svg'
import utilityCollapse from '../assets/figma/utility-collapse.svg'
import utilityExpand from '../assets/figma/utility-expand.svg'
import { StatusPill } from '../components/StatusPill/StatusPill'
import { LayoutDiagnostics } from '../components/LayoutDiagnostics/LayoutDiagnostics'
import { isCleaningProfile } from '../api/decaid/adapters'
import type { AvailableScale, BrewProfile, BrewingScreenModel, DataConnection, EditableMachineSetting, EditableProfileSetting, LiveBrewState, LiveUtilityOperation, PreviousShotStatus, ScaleConnection, SettingFeedback } from '../domain/brewing'
import { BrewingPanel } from '../features/brew/BrewingPanel'
import { LiveBrewingScreen } from '../features/brew/LiveBrewingScreen'
import { CleaningSequencePicker } from '../features/cleaning/CleaningSequencePicker'
import { HistoryPanel } from '../features/history/HistoryPanel'
import { MachineUtilityCard } from '../features/machine/MachineUtilityCard'
import { LiveUtilityOperationOverlay } from '../features/machine/LiveUtilityOperationOverlay'
import { ScaleDevicePicker } from '../features/machine/ScaleDevicePicker'
import { SleepWakeScreen } from '../features/sleep/SleepWakeScreen'

interface AppShellProps {
  model: BrewingScreenModel
  allProfiles: BrewProfile[]
  liveBrew: LiveBrewState
  utilityOperation: LiveUtilityOperation | null
  previousShotStatus: PreviousShotStatus
  connection: DataConnection
  machineConnection: DataConnection
  heatingSeconds: number | null
  sleepPending: boolean
  sleepScreenActive: boolean
  machineActionError: string | null
  settingFeedback: SettingFeedback | null
  settingsDisabled: boolean
  scale: ScaleConnection
  availableScales: AvailableScale[]
  scaleConnectPendingId: string | null
  scaleTarePending: boolean
  brewStopPending: boolean
  brewSkipPending: boolean
  cleaningStartPending: boolean
  cleaningPreparedProfileId: string | null
  onSleep: () => void
  onWake: () => void
  onStopEspresso: () => void
  onSkipBrewStage: () => Promise<boolean>
  onPrepareCleaning: (profileId: string) => Promise<boolean>
  onCancelCleaning: () => Promise<boolean>
  onDismissLiveBrew: () => void
  onSearchScale: () => void
  onConnectScale: (deviceId: string) => void
  onDismissScalePicker: () => void
  onTareScale: () => void
  onUpdateMachineSetting: (setting: EditableMachineSetting, value: number) => void
  onUpdateProfileSetting: (profileId: string, setting: EditableProfileSetting, value: number) => void
  onSelectProfile: (profileId: string) => Promise<boolean>
  onStartDemoBrew: (profileId: string) => void
  onOpenSettings: () => void
  onManageProfiles: () => void
  onOpenPreviousShot: () => void
}

const utilityLayoutStorageKey = 'bestpresso.utility-layout-collapsed.v1'

const initialUtilityLayout = () => {
  try {
    return window.localStorage.getItem(utilityLayoutStorageKey) === 'true'
  } catch {
    return false
  }
}

export function AppShell({ model, allProfiles, liveBrew, utilityOperation, previousShotStatus, connection, machineConnection, heatingSeconds, sleepPending, sleepScreenActive, machineActionError, settingFeedback, settingsDisabled, scale, availableScales, scaleConnectPendingId, scaleTarePending, brewStopPending, brewSkipPending, cleaningStartPending, cleaningPreparedProfileId, onSleep, onWake, onStopEspresso, onSkipBrewStage, onPrepareCleaning, onCancelCleaning, onDismissLiveBrew, onSearchScale, onConnectScale, onDismissScalePicker, onTareScale, onUpdateMachineSetting, onUpdateProfileSetting, onSelectProfile, onStartDemoBrew, onOpenSettings, onManageProfiles, onOpenPreviousShot }: AppShellProps) {
  const [utilitiesCollapsed, setUtilitiesCollapsed] = useState(initialUtilityLayout)
  const [utilityLayoutHasChanged, setUtilityLayoutHasChanged] = useState(false)
  const [cleaningPickerOpen, setCleaningPickerOpen] = useState(false)
  const cleaningProfiles = allProfiles.filter(isCleaningProfile).slice(0, 8)
  const sleepLabel = model.readiness === 'sleeping' ? 'Wake' : 'Sleep'
  const toggleUtilityLayout = () => {
    setUtilityLayoutHasChanged(true)
    setUtilitiesCollapsed((collapsed) => {
      const nextCollapsed = !collapsed
      try {
        window.localStorage.setItem(utilityLayoutStorageKey, String(nextCollapsed))
      } catch {
        // Preference persistence is optional; the current session still updates.
      }
      return nextCollapsed
    })
  }
  const dismissCleaningPicker = async () => {
    if (await onCancelCleaning()) setCleaningPickerOpen(false)
  }
  if (sleepScreenActive) return <SleepWakeScreen onWake={onWake} />
  if (liveBrew.visible && !utilityOperation) return <LiveBrewingScreen model={model} liveBrew={liveBrew} stopPending={brewStopPending} skipPending={brewSkipPending} actionError={machineActionError} onStop={onStopEspresso} onSkipStage={onSkipBrewStage} onDismiss={onDismissLiveBrew} />
  return <main className={`app-shell${utilitiesCollapsed ? ' app-shell--utilities-collapsed' : ''}${utilityLayoutHasChanged ? ' app-shell--utility-layout-transitioned' : ''}`}>
    <LayoutDiagnostics />
    <header className="topbar"><div className="topbar__brand"><button className="utility-layout-toggle" type="button" aria-label={utilitiesCollapsed ? 'Expand utility panels' : 'Minimize utility panels'} aria-controls="machine-utilities" aria-expanded={!utilitiesCollapsed} title={utilitiesCollapsed ? 'Expand utility panels' : 'Minimize utility panels'} onClick={toggleUtilityLayout}><img src={utilitiesCollapsed ? utilityExpand : utilityCollapse} alt="" /></button><img className="logo" src={logo} alt="decent" /></div><nav aria-label="Machine controls"><button className="control-button control-button--cleaning" type="button" aria-label="Cleaning sequences" title="Cleaning" onClick={() => setCleaningPickerOpen(true)}><img src={cleaning} alt="" /></button><button className={sleepPending ? 'control-button control-button--pending' : 'control-button'} type="button" aria-label={sleepPending ? `${sleepLabel} request in progress` : sleepLabel} title={sleepLabel} disabled={sleepPending} onClick={onSleep}><img src={sleep} alt="" /></button><button className="control-button" type="button" aria-label="Settings" title="Settings" onClick={onOpenSettings}><img src={settings} alt="" /></button><StatusPill status={model.readiness} connection={connection} machineConnection={machineConnection} heatingSeconds={heatingSeconds} /></nav></header>
    {(machineActionError || settingFeedback) && <div className="system-messages">
      {machineActionError && <div className="system-message system-message--error" role="alert">{machineActionError}</div>}
      {settingFeedback && <div className={`system-message system-message--${settingFeedback.status}`} role={settingFeedback.status === 'error' ? 'alert' : 'status'} aria-live="polite">{settingFeedback.message}</div>}
    </div>}
    <div className="dashboard"><aside className="utilities" id="machine-utilities">{model.utilities.map((utility) => <MachineUtilityCard key={utility.id} utility={utility} compact={utilitiesCollapsed} scale={utility.id === 'scale' ? scale : undefined} scaleTarePending={utility.id === 'scale' && scaleTarePending} onExpand={utility.id === 'tank' ? undefined : toggleUtilityLayout} onSearchScale={utility.id === 'scale' ? onSearchScale : undefined} onTareScale={utility.id === 'scale' ? onTareScale : undefined} settingsDisabled={settingsDisabled} onUpdateSetting={onUpdateMachineSetting} />)}</aside><div className="primary"><BrewingPanel profiles={model.profiles} activeProfileId={model.activeProfileId} settingsDisabled={settingsDisabled} demoMode={connection === 'fixture'} onUpdateProfile={onUpdateProfileSetting} onSelectProfile={onSelectProfile} onStartDemoBrew={onStartDemoBrew} onManageProfiles={onManageProfiles} /><HistoryPanel shot={model.previousShot} status={previousShotStatus} onOpen={onOpenPreviousShot} /></div></div>
    {utilityOperation && <LiveUtilityOperationOverlay operation={utilityOperation} />}
    <ScaleDevicePicker devices={availableScales} pendingDeviceId={scaleConnectPendingId} onSelect={onConnectScale} onDismiss={onDismissScalePicker} />
    {cleaningPickerOpen && <CleaningSequencePicker profiles={cleaningProfiles} pending={cleaningStartPending} preparedProfileId={cleaningPreparedProfileId} onPrepare={onPrepareCleaning} onDismiss={dismissCleaningPicker} />}
  </main>
}
