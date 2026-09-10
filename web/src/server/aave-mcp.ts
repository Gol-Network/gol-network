import 'server-only';

export const AAVE_MCP_URL = 'https://mcp.aave.com/';

export type AaveMcpTool = {
  name: string;
  title?: string | undefined;
  description?: string | undefined;
  inputSchema?: Record<string, unknown> | undefined;
  annotations?:
    | {
        readOnlyHint?: boolean | undefined;
        destructiveHint?: boolean | undefined;
      }
    | undefined;
};

export const AAVE_SIGNED_RELAY_TOOLS = new Set(['submit_signed_order', 'cancel_order']);

async function aaveMcpRequest(
  method: string,
  params: Record<string, unknown>,
  signal?: AbortSignal,
) {
  const timeoutSignal = AbortSignal.timeout(20_000);
  const response = await fetch(AAVE_MCP_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: crypto.randomUUID(), method, params }),
    signal: signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal,
    cache: 'no-store',
  });
  const body = (await response.json()) as {
    result?: unknown;
    error?: { code?: number; message?: string; data?: unknown };
  };
  if (!response.ok || body.error) {
    throw new Error(body.error?.message ?? `Aave MCP returned HTTP ${response.status}`);
  }
  return body.result;
}

export async function listAaveTools(signal?: AbortSignal): Promise<AaveMcpTool[]> {
  const result = (await aaveMcpRequest('tools/list', {}, signal)) as { tools?: AaveMcpTool[] };
  return result.tools ?? [];
}

export async function callAaveTool(
  name: string,
  arguments_: Record<string, unknown>,
  signal?: AbortSignal,
) {
  return aaveMcpRequest('tools/call', { name, arguments: arguments_ }, signal);
}
