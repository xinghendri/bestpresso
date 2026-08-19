import { Icon } from '../../components/Icon/Icon'
import type { MachineUtility } from '../../domain/brewing'
const icons = { water: 'droplet', steam: 'steam', scale: 'scale', tank: 'tank' } as const
export function MachineUtilityCard({ utility }: { utility: MachineUtility }) { return <button className="utility-card" type="button"><span className="utility-card__icon"><Icon name={icons[utility.id]} /></span><span className="utility-card__copy"><span>{utility.label}</span><small>{utility.detail}</small></span><strong>{utility.value}</strong></button> }
