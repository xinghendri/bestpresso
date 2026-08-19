import { Icon } from '../components/Icon/Icon'
import { StatusPill } from '../components/StatusPill/StatusPill'
import type { BrewingScreenModel } from '../domain/brewing'
import { BrewingPanel } from '../features/brew/BrewingPanel'
import { HistoryPanel } from '../features/history/HistoryPanel'
import { MachineUtilityCard } from '../features/machine/MachineUtilityCard'
export function AppShell({ model }: { model: BrewingScreenModel }) { return <main className="app-shell"><header className="topbar"><a className="brand" href="/" aria-label="Bestpresso home"><span>best</span>presso<small>BREWING SYSTEM</small></a><div className="machine-status"><span>{model.machineName}</span><StatusPill status={model.readiness}/><button type="button" aria-label="Sleep"><Icon name="moon"/></button><button type="button" aria-label="Settings"><Icon name="settings"/></button></div></header><div className="dashboard"><aside className="utilities" aria-label="Machine utilities"><div className="utilities__heading"><span className="eyebrow">MACHINE</span><span>Daily controls</span></div>{model.utilities.map((utility) => <MachineUtilityCard key={utility.id} utility={utility}/>)}</aside><div className="primary"><BrewingPanel profile={model.profile}/><HistoryPanel shot={model.previousShot}/></div></div><footer><span>BESTPRESSO / MOCK MODE</span><span>Decaid integration comes next</span></footer></main> }
