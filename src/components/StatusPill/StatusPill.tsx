import readyIcon from '../../assets/figma/ready.svg'
import type { MachineReadiness } from '../../domain/brewing'

export function StatusPill({ status }: { status: MachineReadiness }) {
  return <div className={`status-pill status-pill--${status}`}><img src={readyIcon} alt="" /><strong>{status}</strong></div>
}
