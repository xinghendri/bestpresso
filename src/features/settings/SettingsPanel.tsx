import logo from '../../assets/figma/decent-logo.png'
import type { DataConnection } from '../../domain/brewing'

export function SettingsPanel({ gatewayHost, connection, onClose }: { gatewayHost: string; connection: DataConnection; onClose: () => void }) {
  return <main className="app-shell settings-page">
    <header className="settings-page__header">
      <img className="logo" src={logo} alt="decent" />
      <div>
        <button type="button" className="settings-page__back" onClick={onClose}>Cancel</button>
        <button type="button" className="settings-page__done" onClick={onClose}>Done</button>
      </div>
    </header>
    <div className="settings-layout">
      <nav aria-label="Settings sections">
        <strong>Settings</strong>
        <button className="is-active" type="button">Connection</button>
        <button type="button" disabled>Machine</button>
        <button type="button" disabled>Skin</button>
      </nav>
      <section className="settings-content">
        <p className="settings-content__eyebrow">Connection</p>
        <h1>Decaid gateway</h1>
        <div className="settings-card">
          <span>Gateway address</span><strong>{gatewayHost}</strong>
          <span>Data status</span><strong className={`connection-value connection-value--${connection}`}>{connection}</strong>
        </div>
        <p className="settings-content__note">Bestpresso uses the gateway supplied in the URL, the saved gateway, or the current host—matching Streamline’s gateway discovery behavior.</p>
      </section>
    </div>
  </main>
}
