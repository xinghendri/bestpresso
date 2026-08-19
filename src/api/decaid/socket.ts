import { getDecaidEndpoints } from './config'

export interface SocketSubscription {
  close(): void
}

export function subscribe<T>(path: string, onData: (data: T) => void, onConnection: (connected: boolean) => void): SocketSubscription {
  let socket: WebSocket | null = null
  let retry: number | null = null
  let closed = false

  const connect = () => {
    if (closed) return
    try { socket = new WebSocket(`${getDecaidEndpoints().socketBase}${path}`) }
    catch {
      onConnection(false)
      retry = window.setTimeout(connect, 3000)
      return
    }
    socket.addEventListener('open', () => onConnection(true))
    socket.addEventListener('message', (event) => {
      try { onData(JSON.parse(String(event.data)) as T) } catch { /* ignore malformed frames */ }
    })
    socket.addEventListener('close', () => {
      onConnection(false)
      if (!closed) retry = window.setTimeout(connect, 3000)
    })
    socket.addEventListener('error', () => socket?.close())
  }

  connect()
  return { close() { closed = true; if (retry !== null) window.clearTimeout(retry); socket?.close() } }
}
