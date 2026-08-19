const API_PORT = 8080

function storedGateway() {
  try { return localStorage.getItem('bestpressoGateway') || localStorage.getItem('reaHostname') }
  catch { return null }
}

export function getGatewayHost() {
  const queryGateway = new URLSearchParams(window.location.search).get('gateway')
  if (queryGateway) {
    try { localStorage.setItem('bestpressoGateway', queryGateway) } catch { /* storage is optional */ }
    return queryGateway
  }
  return storedGateway() || window.location.hostname || 'localhost'
}

function hostWithPort(host: string) {
  return /^\[[^\]]+\]:\d+$/.test(host) || /^[^:]+:\d+$/.test(host) ? host : `${host}:${API_PORT}`
}

export function getDecaidEndpoints() {
  const host = hostWithPort(getGatewayHost())
  const secure = window.location.protocol === 'https:'
  return {
    gatewayHost: getGatewayHost(),
    apiBase: `${secure ? 'https' : 'http'}://${host}/api/v1`,
    socketBase: `${secure ? 'wss' : 'ws'}://${host}/ws/v1`,
  }
}
