import { Injectable, signal, OnDestroy } from '@angular/core';

export interface AgentStatusMessage {
  type: 'agent_status';
  agent: string;
  status: string;
  message: string;
}

export interface AgentOutputMessage {
  type: 'agent_output';
  agent: string;
  output: string;
  finished: boolean;
}

export interface PipelineCompleteMessage {
  type: 'pipeline_complete';
  result: {
    audit: string;
    refactored: string;
    validation: string;
  };
}

export interface ErrorMessage {
  type: 'error';
  message: string;
}

export type WsMessage = AgentStatusMessage | AgentOutputMessage | PipelineCompleteMessage | ErrorMessage;

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

@Injectable({ providedIn: 'root' })
export class AgentWsService implements OnDestroy {
  public connectionStatus = signal<ConnectionStatus>('disconnected');

  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private messageHandlers: Array<(msg: WsMessage) => void> = [];

  connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.connectionStatus.set('connecting');
    this.ws = new WebSocket('/ws/agents');

    this.ws.onopen = () => {
      this.connectionStatus.set('connected');
      this.reconnectAttempts = 0;
      this.startHeartbeat();
    };

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const msg: WsMessage = JSON.parse(event.data);
        this.messageHandlers.forEach(fn => fn(msg));
      } catch {
        // ignore malformed messages
      }
    };

    this.ws.onclose = () => {
      this.stopHeartbeat();
      this.connectionStatus.set('disconnected');
      this.tryReconnect();
    };

    this.ws.onerror = () => {
      this.connectionStatus.set('error');
    };
  }

  disconnect(): void {
    this.reconnectAttempts = this.maxReconnectAttempts;
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    this.connectionStatus.set('disconnected');
  }

  sendAnalyze(code: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'analyze', code }));
    }
  }

  onMessage(handler: (msg: WsMessage) => void): void {
    this.messageHandlers.push(handler);
  }

  removeMessageHandler(handler: (msg: WsMessage) => void): void {
    const idx = this.messageHandlers.indexOf(handler);
    if (idx !== -1) this.messageHandlers.splice(idx, 1);
  }

  ngOnDestroy(): void {
    this.disconnect();
    this.messageHandlers = [];
  }

  private tryReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
    const delay = Math.pow(2, this.reconnectAttempts) * 1000;
    this.reconnectAttempts++;
    setTimeout(() => this.connect(), delay);
  }

  private startHeartbeat(): void {
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);
  }

  private stopHeartbeat(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
}
