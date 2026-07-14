import { TestBed } from '@angular/core/testing';
import { AgentWsService, WsMessage } from './agent-ws.service';

describe('AgentWsService', () => {
  let service: AgentWsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AgentWsService);
  });

  afterEach(() => {
    vi.useRealTimers();
    service.disconnect();
  });

  it('should start disconnected', () => {
    expect(service.connectionStatus()).toBe('disconnected');
  });

  it('should set connecting on connect', () => {
    service.connect();
    expect(service.connectionStatus()).toBe('connecting');
  });

  it('should call onMessage handler when message arrives', () => {
    service.connect();
    const handler = vi.fn();
    service.onMessage(handler);

    const ws = service._test().ws;
    expect(ws).toBeTruthy();
    ws!.onmessage({ data: JSON.stringify({
      type: 'pipeline_complete',
      result: { audit: 'ok', refactored: 'ok', validation: 'ok' }
    })});
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'pipeline_complete' })
    );
  });

  it('should ignore malformed JSON', () => {
    service.connect();
    const handler = vi.fn();
    service.onMessage(handler);
    const ws = service._test().ws;
    ws!.onmessage({ data: 'not json' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('should disconnect gracefully', () => {
    service.connect();
    service.disconnect();
    expect(service.connectionStatus()).toBe('disconnected');
  });

  it('should send analyze message', () => {
    service.connect();
    const ws = service._test().ws;
    const sendSpy = vi.fn();
    ws!.send = sendSpy;
    service.sendAnalyze('const x = 1;');
    expect(sendSpy).toHaveBeenCalledWith(
      JSON.stringify({ type: 'analyze', code: 'const x = 1;' })
    );
  });

  it('should not reconnect after max attempts', () => {
    vi.useFakeTimers();
    service.connect();
    const test = service._test();
    test.reconnectAttempts = 3;
    test.maxReconnectAttempts = 3;
    const ws = test.ws;
    ws!.onclose!({} as CloseEvent);
    vi.advanceTimersByTime(10000);
    expect(test.reconnectAttempts).toBe(3);
  });

  it('should handle multiple message handlers', () => {
    service.connect();
    const h1 = vi.fn();
    const h2 = vi.fn();
    service.onMessage(h1);
    service.onMessage(h2);
    const ws = service._test().ws;
    ws!.onmessage({ data: JSON.stringify({ type: 'agent_status', agent: 'a', status: 'running', message: '' }) });
    expect(h1).toHaveBeenCalled();
    expect(h2).toHaveBeenCalled();
  });

  it('should remove message handler', () => {
    service.connect();
    const h1 = vi.fn();
    service.onMessage(h1);
    service.removeMessageHandler(h1);
    const ws = service._test().ws;
    ws!.onmessage({ data: JSON.stringify({ type: 'agent_status', agent: 'a', status: 'running', message: '' }) });
    expect(h1).not.toHaveBeenCalled();
  });
});
