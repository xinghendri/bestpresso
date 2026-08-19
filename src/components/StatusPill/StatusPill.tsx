import heatingIcon from '../../assets/figma/heating.svg'
import notHeatingIcon from '../../assets/figma/not-heating.svg'
import readyIcon from '../../assets/figma/ready.svg'
import type { DataConnection, MachineReadiness } from '../../domain/brewing'

export function StatusPill({ status, connection, heatingSeconds }: { status: MachineReadiness; connection: DataConnection; heatingSeconds?: number | null }) {
  if (connection === 'connected' && status === 'notHeating') {
    return <div className="status-pill status-pill--not-heating" title="The group is not warming. Check the physical power button." role="status" aria-live="assertive"><img src={notHeatingIcon} alt="" /><span><strong>Not heating</strong><small>Check power button</small></span></div>
  }
  if (connection === 'connected' && status === 'heating') {
    return <div className="status-pill status-pill--heating" title="Machine is heating" role="status" aria-live="polite"><img src={heatingIcon} alt="" /><strong>Heating</strong>{heatingSeconds !== null && heatingSeconds !== undefined && heatingSeconds > 0 && <span>{heatingSeconds}s</span>}</div>
  }
  const label = connection === 'connected' ? status : connection === 'fixture' ? 'Demo' : connection
  const visualState = connection === 'fixture' ? status : label.toLowerCase()
  return <div className={`status-pill status-pill--${visualState}`} title={`Data source: ${connection}`} role="status"><img src={readyIcon} alt="" /><strong>{label}</strong></div>
}
