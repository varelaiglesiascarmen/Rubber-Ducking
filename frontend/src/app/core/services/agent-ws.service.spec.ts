import { TestBed } from '@angular/core/testing';
import { AgentWsService } from './agent-ws.service';

describe('AgentWsService', () => {
  let service: AgentWsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AgentWsService);
  });

  afterEach(() => {
    service.disconnect();
  });

  it('should start disconnected', () => {
    expect(service.connectionStatus()).toBe('disconnected');
  });

  it('should set connecting on connect', () => {
    service.connect();
    expect(service.connectionStatus()).toBe('connecting');
  });

  it('should call onMessage handler when message arrives', (done) => {
    service.connect();
    service.onMessage((msg) => {
      if (msg.type === 'pipeline_complete') {
        done();
      }
    });

    const ws = (service as any).ws;
    expect(ws).toBeTruthy();
    ws.onmessage({ data: JSON.stringify({
      type: 'pipeline_complete',
      result: { audit: 'ok', refactored: 'ok', validation: 'ok' }
    })});
  });

  it('should ignore malformed JSON', () => {
    service.connect();
    let called = false;
    service.onMessage(() => called = true);
    const ws = (service as any).ws;
    ws.onmessage({ data: 'not json' });
    expect(called).toBeFalse();
  });

  it('should disconnect gracefully', () => {
    service.connect();
    service.disconnect();
    expect(service.connectionStatus()).toBe('disconnected');
  });

  it('should send analyze message', () => {
    service.connect();
    const ws = (service as any).ws;
    spyOn(ws, 'send');
    service.sendAnalyze('const x = 1;');
    expect(ws.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'analyze', code: 'const x = 1;' })
    );
  });

  it('should not reconnect after max attempts', () => {
    jasmine.clock().install();
    service.connect();
    (service as any).reconnectAttempts = 3;
    (service as any).maxReconnectAttempts = 3;
    const ws = (service as any).ws;
    ws.onclose();
    jasmine.clock().tick(10000);
    expect((service as any).reconnectAttempts).toBe(3);
    jasmine.clock().uninstall();
  });

  it('should handle multiple message handlers', () => {
    service.connect();
    const h1 = jasmine.createSpy('h1');
    const h2 = jasmine.createSpy('h2');
    service.onMessage(h1);
    service.onMessage(h2);
    const ws = (service as any).ws;
    ws.onmessage({ data: JSON.stringify({ type: 'agent_status', agent: 'a', status: 'running', message: '' }) });
    expect(h1).toHaveBeenCalled();
    expect(h2).toHaveBeenCalled();
  });

  it('should remove message handler', () => {
    service.connect();
    const h1 = jasmine.createSpy('h1');
    service.onMessage(h1);
    service.removeMessageHandler(h1);
    const ws = (service as any).ws;
    ws.onmessage({ data: JSON.stringify({ type: 'agent_status', agent: 'a', status: 'running', message: '' }) });
    expect(h1).not.toHaveBeenCalled();
  });
});
