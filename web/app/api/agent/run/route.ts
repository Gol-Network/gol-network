import { RunAgentInputSchema } from '@ag-ui/core';

export const runtime = 'nodejs';

const DEFAULT_AGENT_URL = 'http://127.0.0.1:8124/agent';

function agentUrl(): string {
  return process.env.LANGGRAPH_AGENT_URL?.trim() || DEFAULT_AGENT_URL;
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > 64_000) {
    return Response.json({ error: 'AGENT_INPUT_TOO_LARGE' }, { status: 413 });
  }

  let input;
  try {
    const body = await request.text();
    if (new TextEncoder().encode(body).byteLength > 64_000) {
      return Response.json({ error: 'AGENT_INPUT_TOO_LARGE' }, { status: 413 });
    }
    input = RunAgentInputSchema.parse(JSON.parse(body));
  } catch (error) {
    return Response.json(
      {
        error: 'INVALID_AG_UI_INPUT',
        detail: error instanceof Error ? error.message : 'Invalid AG-UI request.',
      },
      { status: 400 },
    );
  }

  try {
    const sharedSecret = process.env.GOL_AGENT_SHARED_SECRET?.trim();
    const upstream = await fetch(agentUrl(), {
      method: 'POST',
      headers: {
        accept: 'text/event-stream',
        'content-type': 'application/json',
        ...(sharedSecret ? { 'x-gol-agent-token': sharedSecret } : {}),
      },
      body: JSON.stringify(input),
      cache: 'no-store',
      signal: request.signal,
    });
    if (!upstream.ok || !upstream.body) {
      const detail = (await upstream.text()).slice(0, 500);
      return Response.json(
        { error: 'LANGGRAPH_AGENT_UNAVAILABLE', detail },
        { status: upstream.status || 502 },
      );
    }
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        'content-type': upstream.headers.get('content-type') ?? 'text/event-stream',
        'cache-control': 'no-cache, no-transform',
        connection: 'keep-alive',
        'x-accel-buffering': 'no',
      },
    });
  } catch (error) {
    return Response.json(
      {
        error: 'LANGGRAPH_AGENT_UNAVAILABLE',
        detail: error instanceof Error ? error.message : 'Agent request failed.',
      },
      { status: 502 },
    );
  }
}

export async function GET() {
  try {
    const upstream = await fetch(new URL('/health', agentUrl()), {
      cache: 'no-store',
      signal: AbortSignal.timeout(3_000),
    });
    if (!upstream.ok) throw new Error(`LangGraph health returned ${upstream.status}`);
    return Response.json({ connected: true, upstream: await upstream.json() });
  } catch (error) {
    return Response.json(
      {
        connected: false,
        error: error instanceof Error ? error.message : 'LangGraph health check failed.',
      },
      { status: 503 },
    );
  }
}
