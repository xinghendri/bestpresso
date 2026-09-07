import { getDecaidEndpoints } from './config'

export interface SocketSubscription {
  close(): void
}

export interface CommandSocketSubscription<TCommand> extends SocketSubscription {
  send(command: TCommand): boolean
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

export function subscribeWithCommands<TData, TCommand>(
  path: string,
  onData: (data: TData) => void,
  onConnection: (connected: boolean) => void,
  onOpen?: (send: (command: TCommand) => boolean) => void,
): CommandSocketSubscription<TCommand> {
  let socket: WebSocket | null = null
  let retry: number | null = null
  let closed = false

  const send = (command: TCommand) => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return false
    socket.send(JSON.stringify(command))
    return true
  }

  const connect = () => {
    if (closed) return
    try { socket = new WebSocket(`${getDecaidEndpoints().socketBase}${path}`) }
    catch {
      onConnection(false)
      retry = window.setTimeout(connect, 3000)
      return
    }
    socket.addEventListener('open', () => {
      onConnection(true)
      onOpen?.(send)
    })
    socket.addEventListener('message', (event) => {
      try { onData(JSON.parse(String(event.data)) as TData) } catch { /* ignore malformed frames */ }
    })
    socket.addEventListener('close', () => {
      onConnection(false)
      if (!closed) retry = window.setTimeout(connect, 3000)
    })
    socket.addEventListener('error', () => socket?.close())
  }

  connect()
  return {
    send,
    close() {
      closed = true
      if (retry !== null) window.clearTimeout(retry)
      socket?.close()
    },
  }
}
