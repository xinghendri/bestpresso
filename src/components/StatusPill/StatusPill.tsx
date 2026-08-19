import readyIcon from '../../assets/figma/ready.svg'
import type { DataConnection, MachineReadiness } from '../../domain/brewing'

export function StatusPill({ status, connection }: { status: MachineReadiness; connection: DataConnection }) {
  const label = connection === 'connected' ? status : connection === 'fixture' ? 'Demo' : connection
  return <div className={`status-pill status-pill--${label.toLowerCase()}`} title={`Data source: ${connection}`}><img src={readyIcon} alt="" /><strong>{label}</strong></div>
}
