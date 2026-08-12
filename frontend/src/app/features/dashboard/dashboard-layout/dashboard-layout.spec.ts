import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
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
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });

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
      providers: [
        provideNoopAnimations(),
        { provide: AgentWsService, useValue: wsMock },
      ],
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

  it('should copy output to clipboard', async () => {
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    component.codeOutput.set('const x = signal(1);');

    await component.copyOutput();

    expect(writeText).toHaveBeenCalledWith('const x = signal(1);');
    expect(component.copied()).toBe(true);
  });

  it('should not copy when output is empty', async () => {
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    component.codeOutput.set('');

    await component.copyOutput();

    expect(writeText).not.toHaveBeenCalled();
    expect(component.copied()).toBe(false);
  });

  it('should fallback copy when clipboard API is unavailable', async () => {
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValueOnce(new Error('blocked'));
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: vi.fn().mockReturnValue(true),
    });
    component.codeOutput.set('const x = 1;');

    await component.copyOutput();

    expect(document.execCommand).toHaveBeenCalledWith('copy');
    expect(component.copied()).toBe(true);
  });

  it('should NOT orchestrate when pasted text is not real code', () => {
    component.codeInput.set('hfijs');
    expect(component.canOrchestrate()).toBe(false);
    expect(component.missingRequirements()).toContain('código válido');
    component.toggleOrchestration();
    expect(wsMock.connect).not.toHaveBeenCalled();
  });

  it('should orchestrate when pasted text looks like code', () => {
    component.codeInput.set('@Component({ selector: "app-x" }) class X {}');
    expect(component.canOrchestrate()).toBe(true);
    component.toggleOrchestration();
    expect(wsMock.connect).toHaveBeenCalled();
  });

  it('should open cross-framework dialog when stack mismatches', () => {
    component.codeInput.set('import React from "react"; const App = () => <div/>;');
    component.selectedStack.set('angular');
    const openSpy = vi.spyOn(component.dialog, 'open').mockReturnValue({
      afterClosed: () => of('migrate') as any,
    } as any);

    component.toggleOrchestration();

    expect(openSpy).toHaveBeenCalledTimes(1);
  });

  it('should switch stack when dialog returns switch', async () => {
    component.codeInput.set('import React from "react"; const App = () => <div/>;');
    component.selectedStack.set('angular');
    vi.spyOn(component.dialog, 'open').mockReturnValue({
      afterClosed: () => of('switch') as any,
    } as any);

    await component.toggleOrchestration();

    expect(component.selectedStack()).toBe('react');
    expect(wsMock.connect).not.toHaveBeenCalled();
  });

  it('should migrate anyway when dialog returns migrate', async () => {
    component.codeInput.set('import React from "react"; const App = () => <div/>;');
    component.selectedStack.set('angular');
    vi.spyOn(component.dialog, 'open').mockReturnValue({
      afterClosed: () => of('migrate') as any,
    } as any);

    await component.toggleOrchestration();

    expect(wsMock.connect).toHaveBeenCalled();
  });
});
