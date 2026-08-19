import logo from '../assets/figma/decent-logo.png'
import settings from '../assets/figma/settings.svg'
import sleep from '../assets/figma/sleep.svg'
import { StatusPill } from '../components/StatusPill/StatusPill'
import type { BrewingScreenModel, DataConnection } from '../domain/brewing'
import { BrewingPanel } from '../features/brew/BrewingPanel'
import { HistoryPanel } from '../features/history/HistoryPanel'
import { MachineUtilityCard } from '../features/machine/MachineUtilityCard'

export function AppShell({ model, connection, gatewayHost }: { model: BrewingScreenModel; connection: DataConnection; gatewayHost: string }) {
  return <main className="app-shell">
    <header className="topbar"><img className="logo" src={logo} alt="decent" /><nav aria-label="Machine controls"><span className="gateway-label">{gatewayHost}</span><button type="button" aria-label="Sleep"><img src={sleep} alt="" /></button><button type="button" aria-label="Settings"><img src={settings} alt="" /></button><StatusPill status={model.readiness} connection={connection} /></nav></header>
    <div className="dashboard"><aside className="utilities">{model.utilities.map((utility) => <MachineUtilityCard key={utility.id} utility={utility} />)}</aside><div className="primary"><BrewingPanel key={model.activeProfileId ?? 'fixture'} profiles={model.profiles} activeProfileId={model.activeProfileId} /><HistoryPanel shot={model.previousShot} /></div></div>
  </main>
}
