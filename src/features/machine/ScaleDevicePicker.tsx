import scaleIcon from '../../assets/figma/scale.svg'
import type { AvailableScale } from '../../domain/brewing'
import { scalePresentationForDevice } from './scaleArtwork'

interface ScaleDevicePickerProps {
  devices: AvailableScale[]
  pendingDeviceId: string | null
  onSelect: (deviceId: string) => void
  onDismiss: () => void
}

export function ScaleDevicePicker({ devices, pendingDeviceId, onSelect, onDismiss }: ScaleDevicePickerProps) {
  if (devices.length < 2) return null

  return <div className="scale-picker-overlay" role="presentation" onPointerDown={(event) => {
    if (event.target === event.currentTarget && !pendingDeviceId) onDismiss()
  }}>
    <section className="scale-picker" role="dialog" aria-modal="true" aria-labelledby="scale-picker-title" aria-describedby="scale-picker-count">
      <header className="scale-picker__header">
        <div>
          <h2 id="scale-picker-title">Select scale to connect</h2>
          <p id="scale-picker-count">{devices.length} devices found</p>
        </div>
        <img className="scale-picker__hero-icon" src={scaleIcon} alt="" />
      </header>
      <div className="scale-picker__devices">
        {devices.map((device) => {
          const presentation = scalePresentationForDevice(device.name, device.id)
          const displayName = presentation?.displayName ?? device.name
          const isPending = pendingDeviceId === device.id
          return <button
            className={`scale-picker-card${isPending ? ' scale-picker-card--pending' : ''}`}
            data-scale-model={presentation?.id}
            key={device.id}
            type="button"
            disabled={Boolean(pendingDeviceId)}
            aria-label={`Connect ${displayName}`}
            onClick={() => onSelect(device.id)}
          >
            <img className="scale-picker-card__icon" src={scaleIcon} alt="" />
            <strong>{displayName}</strong>
            {presentation?.imageSrc && <span className="scale-picker-card__art" aria-hidden="true"><img src={presentation.imageSrc} alt="" /></span>}
            {isPending && <span className="scale-picker-card__status">Connecting…</span>}
          </button>
        })}
      </div>
    </section>
  </div>
}
