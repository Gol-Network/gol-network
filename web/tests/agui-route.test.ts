import { afterEach, describe, expect, it, vi } from 'vitest';

const validInput = {
  threadId: 'thread-1',
  runId: 'run-1',
  state: { mandateReady: false },
  messages: [{ id: 'message-1', role: 'user', content: 'hello' }],
  tools: [],
  context: [],
  forwardedProps: {},
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('AG-UI LangGraph proxy', () => {
  it('rejects an invalid protocol payload before calling the agent', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { POST } = await import('../app/api/agent/run/route');
    const response = await POST(
      new Request('https://gol.test/api/agent/run', {
        method: 'POST',
        body: JSON.stringify({ messages: [] }),
        headers: { 'content-type': 'application/json' },
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: 'INVALID_AG_UI_INPUT' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('caps bodies even when no content-length header is present', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { POST } = await import('../app/api/agent/run/route');
    const response = await POST(
      new Request('https://gol.test/api/agent/run', {
        method: 'POST',
        body: 'x'.repeat(64_001),
      }),
    );

    expect(response.status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('forwards the private token and streams the upstream response', async () => {
    vi.stubEnv('LANGGRAPH_AGENT_URL', 'http://langgraph-agent:8124/agent');
    vi.stubEnv('GOL_AGENT_SHARED_SECRET', 'private-token');
    const sse = 'data: {"type":"RUN_STARTED"}\n\ndata: {"type":"RUN_FINISHED"}\n\n';
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(sse, {
        headers: { 'content-type': 'text/event-stream' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { POST } = await import('../app/api/agent/run/route');
    const response = await POST(
      new Request('https://gol.test/api/agent/run', {
        method: 'POST',
        body: JSON.stringify(validInput),
        headers: { 'content-type': 'application/json' },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('x-accel-buffering')).toBe('no');
    expect(await response.text()).toBe(sse);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://langgraph-agent:8124/agent',
      expect.objectContaining({
        headers: expect.objectContaining({ 'x-gol-agent-token': 'private-token' }),
      }),
    );
  });
});
