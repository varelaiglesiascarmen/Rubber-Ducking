import { Component, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { animate, query, stagger, style, transition, trigger } from '@angular/animations';
import { firstValueFrom } from 'rxjs';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { AgentWsService, WsMessage } from '../../../core/services/agent-ws.service';
import {
  CrossFrameworkDialogComponent,
  CrossFrameworkDialogData,
} from './cross-framework-dialog';

interface ObjectiveOption {
  key: string;
  label: string;
  desc: string;
}

interface AgentState {
  name: string;
  status: 'idle' | 'running' | 'completed' | 'error';
  label: string;
}

const OBJECTIVES_BY_STACK: Record<string, ObjectiveOption[]> = {
  angular: [
    { key: 'signal',      label: 'Refactorizar a Signals',       desc: 'Convierte lógica legacy a Signals reactivas' },
    { key: 'optimize',    label: 'Optimizar Rendimiento',        desc: 'Mejora detección de cambios y bundle' },
    { key: 'standalone',  label: 'Migrar a Standalone',          desc: 'Elimina módulos y adopta standalone' },
  ],
  react: [
    { key: 'hooks',       label: 'Refactorizar a Hooks',         desc: 'Convierte clases a funciones con Hooks' },
    { key: 'optimize',    label: 'Optimizar Rendimiento',        desc: 'Mejora renderizado y bundle' },
    { key: 'server',      label: 'Migrar a Server Components',   desc: 'Adopta React Server Components' },
  ],
  vue: [
    { key: 'setup',       label: 'Refactorizar a Script Setup',  desc: 'Convierte Options API a Composition API' },
    { key: 'optimize',    label: 'Optimizar Rendimiento',        desc: 'Mejora reactividad y bundle' },
    { key: 'composition', label: 'Migrar a Composition API',     desc: 'Adopta patrón Composition API' },
  ],
};

const STACK_LABELS: Record<string, string> = {
  angular: 'Angular 21',
  react: 'React 19',
  vue: 'Vue 4',
};

const COMPATIBLE_OBJECTIVES: Record<string, string[]> = {
  angular: ['signal', 'optimize', 'standalone'],
  react: ['hooks', 'optimize', 'server'],
  vue: ['setup', 'optimize', 'composition'],
};

const FRAMEWORK_DETECTORS: [RegExp, string][] = [
  [/from\s+['"]@angular\/|@Component|@NgModule|@Injectable/, 'angular'],
  [/from\s+['"]react['"]|import\s+React|\.jsx['"]/, 'react'],
  [/from\s+['"]vue['"]|defineComponent|createApp|\.vue['"]/, 'vue'],
];

const CODE_KEYWORDS = /\b(?:import|from|function|class|const|let|var|return|def|interface|type|export|require|new)\b|[{}();<>]/;

function looksLikeCode(code: string): boolean {
  const meaningful = code.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, '').trim();
  if (meaningful.length < 8) return false;
  return CODE_KEYWORDS.test(meaningful);
}

@Component({
  selector: 'app-dashboard-layout',
  standalone: true,
  imports: [MatSidenavModule, MatTooltipModule, MatIconModule],
  templateUrl: './dashboard-layout.html',
  styleUrl: './dashboard-layout.css',
  animations: [
    trigger('objectiveFlash', [
      transition('* => *', [
        query('.card-option', [
          style({ opacity: 0, transform: 'translateX(-14px)' }),
          stagger(90, animate('420ms cubic-bezier(0.4, 0, 0.2, 1)', style({ opacity: 1, transform: 'translateX(0)' }))),
        ]),
      ]),
    ]),
  ],
})
export class DashboardLayoutComponent implements OnInit, OnDestroy {
  public selectedStack = signal<string>('angular');
  public selectedObjective = signal<string>('signal');
  public sidebarOpen = signal<boolean>(true);
  public reducedMotion = signal<boolean>(false);

  public currentObjectives = computed<ObjectiveOption[]>(() =>
    OBJECTIVES_BY_STACK[this.selectedStack()] ?? OBJECTIVES_BY_STACK['angular']
  );

  public isOrchestrating = signal<boolean>(false);
  public connectionStatus = computed(() => this.ws.connectionStatus());
  public statusLabel = computed(() => {
    if (this.ws.connectionStatus() === 'connecting') return 'Conectando...';
    if (this.isOrchestrating()) return 'Orquestando con BillAI...';
    return 'BillAI en espera.';
  });

  public toggleSidebar(): void {
    this.sidebarOpen.update(open => !open);
  }

  public missingRequirements = computed<string[]>(() => {
    const missing: string[] = [];
    if (!this.selectedStack()) missing.push('stack');
    if (!this.selectedObjective()) missing.push('objetivo');
    const code = this.codeInput().trim();
    if (!code) missing.push('código original');
    else if (!looksLikeCode(code)) missing.push('código válido');
    return missing;
  });

  public canOrchestrate = computed(() => this.missingRequirements().length === 0);

  public agents = signal<AgentState[]>([
    { name: 'auditor', status: 'idle', label: 'Auditor de Sintaxis' },
    { name: 'programmer', status: 'idle', label: 'Programador' },
    { name: 'validator', status: 'idle', label: 'Validador' },
  ]);

  public consoleLogs = signal<string[]>([]);
  public codeInput = signal<string>('');
  public codeOutput = signal<string>('');
  public copied = signal<boolean>(false);

  private copiedTimeout: ReturnType<typeof setTimeout> | null = null;

  private handler = (msg: WsMessage) => this.handleMessage(msg);
  private _pollInterval: ReturnType<typeof setInterval> | null = null;
  private _pollTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(private ws: AgentWsService, public dialog: MatDialog) {}

  ngOnInit(): void {
    this.reducedMotion.set(
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
    this.ws.onMessage(this.handler);
  }

  ngOnDestroy(): void {
    this.ws.removeMessageHandler(this.handler);
    this._clearPolling();
    if (this.copiedTimeout !== null) {
      clearTimeout(this.copiedTimeout);
      this.copiedTimeout = null;
    }
  }

  public async copyOutput(): Promise<void> {
    const code = this.codeOutput().trim();
    if (!code) return;

    try {
      await navigator.clipboard.writeText(code);
    } catch {
      this.fallbackCopy(code);
    }

    this.copied.set(true);
    if (this.copiedTimeout !== null) clearTimeout(this.copiedTimeout);
    this.copiedTimeout = setTimeout(() => this.copied.set(false), 2000);
  }

  private fallbackCopy(text: string): void {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
    } finally {
      document.body.removeChild(ta);
    }
  }

  public setStack(stack: string): void {
    this.selectedStack.set(stack);
    const compat = COMPATIBLE_OBJECTIVES[stack] ?? [];
    if (!compat.includes(this.selectedObjective())) {
      this.selectedObjective.set(compat[0] ?? '');
    }
  }

  public setObjective(obj: string): void {
    this.selectedObjective.set(obj);
  }

  public isObjCompatible(obj: string): boolean {
    return (COMPATIBLE_OBJECTIVES[this.selectedStack()] ?? []).includes(obj);
  }

  public objTooltip(obj: string): string {
    return `Opción incompatible con ${STACK_LABELS[this.selectedStack()] ?? this.selectedStack()}`;
  }

  public orchestrationTooltip(): string {
    const missing = this.missingRequirements();
    if (missing.length === 0) return '';
    return `Falta: ${missing.join(', ')}`;
  }

  public toggleOrchestration(): void | Promise<void> {
    if (this.isOrchestrating()) {
      this.stopOrchestration();
      return;
    }

    const missing = this.missingRequirements();
    if (missing.length > 0) {
      alert(`No se puede iniciar la orquestación. Faltan: ${missing.join(', ')}`);
      return;
    }

    return this.maybeConfirmFramework();
  }

  private async maybeConfirmFramework(): Promise<void> {
    const detected = this.detectFramework(this.codeInput());
    if (detected && detected !== this.selectedStack()) {
      const detectedLabel = STACK_LABELS[detected] ?? detected;
      const selectedLabel = STACK_LABELS[this.selectedStack()] ?? this.selectedStack();
      const data: CrossFrameworkDialogData = { detectedLabel, selectedLabel };
      const choice = await firstValueFrom(
        this.dialog
          .open(CrossFrameworkDialogComponent, { data, autoFocus: false })
          .afterClosed()
      );

      if (choice === 'switch') {
        this.setStack(detected);
        return;
      }
      if (choice !== 'migrate') {
        return;
      }
    }

    this.startOrchestration();
  }

  private detectFramework(code: string): string | null {
    for (const [regex, framework] of FRAMEWORK_DETECTORS) {
      if (regex.test(code)) return framework;
    }
    return null;
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
          this.ws.sendAnalyze(this.codeInput(), this.selectedStack(), this.selectedObjective());
        }
      }, 100);
      this._pollTimeout = setTimeout(() => this._clearPolling(), 10000);
    } else {
      this.ws.sendAnalyze(this.codeInput(), this.selectedStack(), this.selectedObjective());
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