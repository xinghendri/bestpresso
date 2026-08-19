import logo from '../assets/figma/decent-logo.png'
import settings from '../assets/figma/settings.svg'
import sleep from '../assets/figma/sleep.svg'
import { StatusPill } from '../components/StatusPill/StatusPill'
import type { BrewingScreenModel, DataConnection, ScaleConnection } from '../domain/brewing'
import { BrewingPanel } from '../features/brew/BrewingPanel'
import { HistoryPanel } from '../features/history/HistoryPanel'
import { MachineUtilityCard } from '../features/machine/MachineUtilityCard'

interface AppShellProps {
  model: BrewingScreenModel
  connection: DataConnection
  gatewayHost: string
  heatingSeconds: number | null
  sleepPending: boolean
  sleepScreenActive: boolean
  machineActionError: string | null
  scale: ScaleConnection
  onSleep: () => void
  onWake: () => void
  onSearchScale: () => void
  onOpenSettings: () => void
  onManageProfiles: () => void
}

export function AppShell({ model, connection, gatewayHost, heatingSeconds, sleepPending, sleepScreenActive, machineActionError, scale, onSleep, onWake, onSearchScale, onOpenSettings, onManageProfiles }: AppShellProps) {
  const sleepLabel = model.readiness === 'sleeping' ? 'Wake' : 'Sleep'
  if (sleepScreenActive) return <button className="sleep-screen" type="button" aria-label="Wake machine" onClick={onWake}><span>Tap to wake</span></button>
  return <main className="app-shell">
    <header className="topbar"><img className="logo" src={logo} alt="decent" /><nav aria-label="Machine controls"><span className="gateway-label">{gatewayHost}</span><button className={sleepPending ? 'control-button control-button--pending' : 'control-button'} type="button" aria-label={sleepPending ? `${sleepLabel} request in progress` : sleepLabel} title={sleepLabel} disabled={sleepPending} onClick={onSleep}><img src={sleep} alt="" /></button><button className="control-button" type="button" aria-label="Settings" title="Settings" onClick={onOpenSettings}><img src={settings} alt="" /></button><StatusPill status={model.readiness} connection={connection} heatingSeconds={heatingSeconds} /></nav></header>
    {machineActionError && <div className="action-notice" role="alert">{machineActionError}</div>}
    <div className="dashboard"><aside className="utilities">{model.utilities.map((utility) => <MachineUtilityCard key={utility.id} utility={utility} scale={utility.id === 'scale' ? scale : undefined} onSearchScale={utility.id === 'scale' ? onSearchScale : undefined} />)}</aside><div className="primary"><BrewingPanel key={model.activeProfileId ?? 'fixture'} profiles={model.profiles} activeProfileId={model.activeProfileId} onManageProfiles={onManageProfiles} /><HistoryPanel shot={model.previousShot} /></div></div>
  </main>
}
