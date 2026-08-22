import heatingIcon from '../../assets/figma/heating.svg'
import notHeatingIcon from '../../assets/figma/not-heating.svg'
import readyIcon from '../../assets/figma/ready.svg'
import thirstyIcon from '../../assets/figma/thirsty.svg'
import type { DataConnection, MachineReadiness } from '../../domain/brewing'

export function StatusPill({ status, connection, machineConnection, heatingSeconds }: { status: MachineReadiness; connection: DataConnection; machineConnection: DataConnection; heatingSeconds?: number | null }) {
  const confirmedConnection = connection === 'connected' ? machineConnection : connection

  if (confirmedConnection !== 'connected') {
    const label = confirmedConnection === 'fixture' ? 'Demo' : confirmedConnection
    const visualState = confirmedConnection === 'fixture' ? status : confirmedConnection
    const source = connection === 'connected' ? 'Machine' : 'Data source'
    return <div className={`status-pill status-pill--${visualState}`} title={`${source}: ${confirmedConnection}`} role="status"><img src={readyIcon} alt="" /><strong>{label}</strong></div>
  }

  if (status === 'notHeating') {
    return <div className="status-pill status-pill--not-heating" title="The group is not warming. Check the physical power button." role="status" aria-live="assertive"><img src={notHeatingIcon} alt="" /><span><strong>Not heating</strong><small>Check power button</small></span></div>
  }
  if (status === 'heating') {
    return <div className="status-pill status-pill--heating" title="Machine is heating" role="status" aria-live="polite"><img src={heatingIcon} alt="" /><strong>Heating</strong>{heatingSeconds !== null && heatingSeconds !== undefined && heatingSeconds > 0 && <span>{heatingSeconds}s</span>}</div>
  }
  if (status === 'thirsty') {
    return <div className="status-pill status-pill--thirsty" title="Water reservoir needs water" role="status" aria-live="assertive"><img src={thirstyIcon} alt="" /><strong>Thirsty</strong></div>
  }
  return <div className={`status-pill status-pill--${status}`} title={`Machine: ${status}`} role="status"><img src={readyIcon} alt="" /><strong>{status}</strong></div>
}
