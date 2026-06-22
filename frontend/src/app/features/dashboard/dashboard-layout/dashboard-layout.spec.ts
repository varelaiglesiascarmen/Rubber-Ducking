import { TestBed, ComponentFixture } from '@angular/core/testing';
import { DashboardLayoutComponent } from './dashboard-layout';
import { AgentWsService } from '../../../core/services/agent-ws.service';

describe('DashboardLayoutComponent', () => {
  let fixture: ComponentFixture<DashboardLayoutComponent>;
  let component: DashboardLayoutComponent;
  let wsSpy: jasmine.SpyObj<AgentWsService>;

  beforeEach(async () => {
    wsSpy = jasmine.createSpyObj('AgentWsService', [
      'connect', 'disconnect', 'sendAnalyze',
      'onMessage', 'removeMessageHandler'
    ], {
      connectionStatus: jasmine.createSpy('connectionStatus')
    });
    (wsSpy as any).connectionStatus.and.returnValue('disconnected');

    await TestBed.configureTestingModule({
      imports: [DashboardLayoutComponent],
      providers: [{ provide: AgentWsService, useValue: wsSpy }],
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
    expect(agents.every(a => a.status === 'idle')).toBeTrue();
  });

  it('should toggle orchestration on button click', () => {
    component.toggleOrchestration();
    expect(wsSpy.connect).toHaveBeenCalled();
  });

  it('should stop orchestration on second toggle', () => {
    component.toggleOrchestration();
    component.toggleOrchestration();
    expect(wsSpy.disconnect).toHaveBeenCalled();
  });

  it('should handle agent_status message', () => {
    component.ngOnInit();
    const handler = wsSpy.onMessage.calls.argsFor(0)[0];
    handler({ type: 'agent_status', agent: 'auditor', status: 'running', message: 'Analyzing...' });

    const agent = component.agents().find(a => a.name === 'auditor');
    expect(agent?.status).toBe('running');
  });

  it('should handle pipeline_complete message', () => {
    component.ngOnInit();
    component.isOrchestrating.set(true);

    const handler = wsSpy.onMessage.calls.argsFor(0)[0];
    handler({
      type: 'pipeline_complete',
      result: { audit: 'ok', refactored: 'const x = signal(1);', validation: 'ok' }
    });

    expect(component.codeOutput()).toBe('const x = signal(1);');
    expect(component.isOrchestrating()).toBeFalse();
  });

  it('should handle error message', () => {
    component.ngOnInit();
    const handler = wsSpy.onMessage.calls.argsFor(0)[0];
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
    component.toggleOrchestration();
    component.toggleOrchestration();
    expect(component.agents().every(a => a.status === 'idle')).toBeTrue();
  });
});
