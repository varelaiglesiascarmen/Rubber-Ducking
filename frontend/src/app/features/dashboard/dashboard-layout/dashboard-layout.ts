import { Component, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { MatSidenavModule } from '@angular/material/sidenav';
import { AgentWsService, WsMessage } from '../../../core/services/agent-ws.service';

interface AgentState {
  name: string;
  status: 'idle' | 'running' | 'completed' | 'error';
  label: string;
}

@Component({
  selector: 'app-dashboard-layout',
  standalone: true,
  imports: [MatSidenavModule],
  templateUrl: './dashboard-layout.html',
  styleUrl: './dashboard-layout.css'
})
export class DashboardLayoutComponent implements OnInit, OnDestroy {
  public selectedStack = signal<string>('angular');
  public selectedObjective = signal<string>('refactor');

  public isOrchestrating = signal<boolean>(false);
  public connectionStatus = computed(() => this.ws.connectionStatus());
  public statusLabel = computed(() => {
    if (this.ws.connectionStatus() === 'connecting') return 'Conectando...';
    if (this.isOrchestrating()) return 'Orquestando con BillAI...';
    return 'BillAI en espera.';
  });

  public agents = signal<AgentState[]>([
    { name: 'auditor', status: 'idle', label: 'Auditor de Sintaxis' },
    { name: 'programmer', status: 'idle', label: 'Programador Signals' },
    { name: 'validator', status: 'idle', label: 'Validador AST' }
  ]);

  public consoleLogs = signal<string[]>([]);
  public codeInput = signal<string>('');
  public codeOutput = signal<string>('');

  private handler = (msg: WsMessage) => this.handleMessage(msg);
  private _pollInterval: ReturnType<typeof setInterval> | null = null;
  private _pollTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(private ws: AgentWsService) {}

  ngOnInit(): void {
    this.ws.onMessage(this.handler);
  }

  ngOnDestroy(): void {
    this.ws.removeMessageHandler(this.handler);
    this._clearPolling();
  }

  public setStack(stack: string): void {
    this.selectedStack.set(stack);
  }

  public setObjective(obj: string): void {
    this.selectedObjective.set(obj);
  }

  public toggleOrchestration(): void {
    if (this.isOrchestrating()) {
      this.stopOrchestration();
    } else {
      this.startOrchestration();
    }
  }

  private startOrchestration(): void {
    this.clearConsole();
    this.codeOutput.set('');
    this.resetAgents();
    this.isOrchestrating.set(true);
    this.ws.connect();
    if (this.ws.connectionStatus() !== 'connected') {
      this._pollInterval = setInterval(() => {
        if (this.ws.connectionStatus() === 'connected') {
          this._clearPolling();
          this.ws.sendAnalyze(this.codeInput());
        }
      }, 100);
      this._pollTimeout = setTimeout(() => this._clearPolling(), 10000);
    } else {
      this.ws.sendAnalyze(this.codeInput());
    }
  }

  private _clearPolling(): void {
    if (this._pollInterval !== null) {
      clearInterval(this._pollInterval);
      this._pollInterval = null;
    }
    if (this._pollTimeout !== null) {
      clearTimeout(this._pollTimeout);
      this._pollTimeout = null;
    }
  }

  private stopOrchestration(): void {
    this.isOrchestrating.set(false);
    this.ws.disconnect();
    this.resetAgents();
    this.addLog('Orquestación detenida por el usuario.');
  }

  private resetAgents(): void {
    this.agents.update(list =>
      list.map(a => ({ ...a, status: 'idle' as const }))
    );
  }

  public clearConsole(): void {
    this.consoleLogs.set([]);
  }

  private handleMessage(msg: WsMessage): void {
    switch (msg.type) {
      case 'agent_status':
        this.handleAgentStatus(msg);
        break;
      case 'agent_output':
        this.handleAgentOutput(msg);
        break;
      case 'pipeline_complete':
        this.handlePipelineComplete(msg);
        break;
      case 'error':
        this.handleError(msg);
        break;
    }
  }

  private handleAgentStatus(msg: { agent: string; status: string; message: string }): void {
    const validStatuses = ['idle', 'running', 'completed', 'error'] as const;
    const status = validStatuses.includes(msg.status as any)
      ? (msg.status as AgentState['status'])
      : 'idle';
    this.agents.update(list =>
      list.map(a => a.name === msg.agent ? { ...a, status } : a)
    );
    this.addLog(`[${msg.agent}] ${msg.message}`);
  }

  private handleAgentOutput(msg: { agent: string; output: string }): void {
    this.addLog(`[${msg.agent}] → ${msg.output.slice(0, 200)}`);
  }

  private handlePipelineComplete(msg: { result: { audit: string; refactored: string; validation: string } }): void {
    const cleaned = msg.result.refactored.replace(/^```\w*\n?|```$/g, '').trim();
    this.codeOutput.set(cleaned);
    this.isOrchestrating.set(false);
    this.addLog('Pipeline completado exitosamente.');
  }

  private handleError(msg: { message: string }): void {
    this.addLog(`Error: ${msg.message}`);
    if (msg.message.includes('Rate limit')) {
      this.isOrchestrating.set(false);
    }
  }

  private addLog(text: string): void {
    const ts = new Date().toLocaleTimeString();
    this.consoleLogs.update(logs => [...logs, `[${ts}] ${text}`]);
  }
}