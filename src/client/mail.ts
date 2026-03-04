import * as t from "./types"

const BACKOFF_BASE_MS = 1000
const BACKOFF_CAP_MS = 30_000

export class Box {
  private ws: WebSocket | null = null
  private outbox: t.ToServerMessage[] = []
  private listener: ((message: t.ToClientMessage) => void) | null = null
  private backoff = BACKOFF_BASE_MS
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private destroyed = false

  onReconnect?: () => void

  constructor(private url: string) {
    this.connect()
  }

  private connect() {
    if (this.destroyed) return

    const ws = new WebSocket(this.url)
    this.ws = ws

    ws.onopen = () => {
      this.backoff = BACKOFF_BASE_MS
      this.dispatchStatus(true)

      for (const message of this.outbox) {
        this.rawSend(message)
      }
      this.outbox = []

      if (this.onReconnect) this.onReconnect()
    }

    ws.onmessage = (event) => {
      if (!this.listener) return
      const message = JSON.parse(event.data) as t.ToClientMessage
      if (message.type === 'VERSION_MISMATCH') {
        window.location.href = `/?_v=${Date.now()}`
        return
      }
      this.listener(message)
    }

    ws.onclose = () => {
      this.dispatchStatus(false)
      this.scheduleReconnect()
    }

    ws.onerror = () => {
      // onclose fires after onerror, so reconnect is handled there
    }
  }

  private scheduleReconnect() {
    if (this.destroyed) return
    if (this.reconnectTimer) return

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, this.backoff)

    this.backoff = Math.min(this.backoff * 2, BACKOFF_CAP_MS)
  }

  private dispatchStatus(connected: boolean) {
    if (!this.listener) return
    this.listener({ type: 'CONNECTION_STATUS', connected } as t.ToClientMessage)
  }

  private rawSend(message: t.ToServerMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
    }
  }

  send(message: t.ToServerMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.rawSend(message)
    } else {
      this.outbox.push(message)
    }
  }

  listen(callback: (message: t.ToClientMessage) => void) {
    this.listener = callback
  }

  destroy() {
    this.destroyed = true
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      this.ws.onclose = null
      this.ws.close()
      this.ws = null
    }
  }
}
