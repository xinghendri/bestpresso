import type { MachineReadiness } from '../../domain/brewing'
export function StatusPill({ status }: { status: MachineReadiness }) { return <div className={`status-pill status-pill--${status}`}><span />{status}</div> }
