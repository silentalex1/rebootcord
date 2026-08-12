type SocketPayload = { event: string; [key: string]: unknown };
type Listener = (data: SocketPayload) => void;

class RCSocket {
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private shouldConnect = false;
  private retryTimer: number | null = null;

  connect() {
    this.shouldConnect = true;
    if (this.ws) return;
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${window.location.host}`);
    this.ws = ws;
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as SocketPayload;
        this.listeners.forEach((l) => l(data));
      } catch {
        // ignore malformed frames
      }
    };
    ws.onclose = () => {
      this.ws = null;
      if (this.shouldConnect) {
        this.retryTimer = window.setTimeout(() => this.connect(), 2500);
      }
    };
    ws.onerror = () => ws.close();
  }

  disconnect() {
    this.shouldConnect = false;
    if (this.retryTimer) window.clearTimeout(this.retryTimer);
    this.ws?.close();
    this.ws = null;
  }

  send(data: Record<string, unknown>) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }
}

export const rcSocket = new RCSocket();
