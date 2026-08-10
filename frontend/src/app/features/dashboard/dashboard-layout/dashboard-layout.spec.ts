import { TestBed, ComponentFixture } from '@angular/core/testing';
import { DashboardLayoutComponent } from './dashboard-layout';
import { AgentWsService } from '../../../core/services/agent-ws.service';

describe('DashboardLayoutComponent', () => {
  let fixture: ComponentFixture<DashboardLayoutComponent>;
  let component: DashboardLayoutComponent;
  let wsMock: {
    connectionStatus: ReturnType<typeof vi.fn>;
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    sendAnalyze: ReturnType<typeof vi.fn>;
    onMessage: ReturnType<typeof vi.fn>;
    removeMessageHandler: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    wsMock = {
      connectionStatus: vi.fn().mockReturnValue('disconnected'),
      connect: vi.fn(),
      disconnect: vi.fn(),
      sendAnalyze: vi.fn(),
      onMessage: vi.fn(),
      removeMessageHandler: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [DashboardLayoutComponent],
      providers: [{ provide: AgentWsService, useValue: wsMock }],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardLayoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should start with idle agents', () => {
    const agents = component.agents();
    expect(agents.every(a => a.status === 'idle')).toBe(true);
  });

  it('should start with sidebar open', () => {
    expect(component.sidebarOpen()).toBe(true);
  });

  it('should toggle the sidebar', () => {
    component.toggleSidebar();
    expect(component.sidebarOpen()).toBe(false);
    component.toggleSidebar();
    expect(component.sidebarOpen()).toBe(true);
  });

  it('should toggle orchestration on button click', () => {
    component.codeInput.set('@Component({ selector: "app-x" }) class X {}');
    component.toggleOrchestration();
    expect(wsMock.connect).toHaveBeenCalled();
  });

  it('should stop orchestration on second toggle', () => {
    component.codeInput.set('@Component({ selector: "app-x" }) class X {}');
    component.toggleOrchestration();
    component.toggleOrchestration();
    expect(wsMock.disconnect).toHaveBeenCalled();
  });

  it('should handle agent_status message', () => {
    component.ngOnInit();
    const handler = wsMock.onMessage.mock.calls[0][0];
    handler({ type: 'agent_status', agent: 'auditor', status: 'running', message: 'Analyzing...' });

    const agent = component.agents().find(a => a.name === 'auditor');
    expect(agent?.status).toBe('running');
  });

  it('should handle pipeline_complete message', () => {
    component.ngOnInit();
    component.isOrchestrating.set(true);

    const handler = wsMock.onMessage.mock.calls[0][0];
    handler({
      type: 'pipeline_complete',
      result: { audit: 'ok', refactored: 'const x = signal(1);', validation: 'ok' }
    });

    expect(component.codeOutput()).toBe('const x = signal(1);');
    expect(component.isOrchestrating()).toBe(false);
  });

  it('should handle error message', () => {
    component.ngOnInit();
    const handler = wsMock.onMessage.mock.calls[0][0];
    handler({ type: 'error', message: 'Rate limit exceeded' });

    expect(component.consoleLogs().length).toBeGreaterThan(0);
    expect(component.consoleLogs()[0]).toContain('Rate limit');
  });

  it('should clear console', () => {
    component.consoleLogs.set(['log1', 'log2']);
    component.clearConsole();
    expect(component.consoleLogs().length).toBe(0);
  });

  it('should reset agents', () => {
    component.agents.update(list =>
      list.map(a => ({ ...a, status: 'running' as const }))
    );
    component.codeInput.set('@Component({ selector: "app-x" }) class X {}');
    component.toggleOrchestration();
    component.toggleOrchestration();
    expect(component.agents().every(a => a.status === 'idle')).toBe(true);
  });
});
