import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  AAVE_MCP_URL,
  AAVE_SIGNED_RELAY_TOOLS,
  callAaveTool,
  listAaveTools,
} from '@/server/aave-mcp';

export const runtime = 'nodejs';

const callSchema = z.object({
  name: z.string().trim().min(1).max(120),
  arguments: z.record(z.string(), z.unknown()).default({}),
});

export async function GET() {
  try {
    const tools = await listAaveTools();
    return NextResponse.json({
      endpoint: AAVE_MCP_URL,
      tools: tools.map(({ name, title, description, inputSchema, annotations }) => ({
        name,
        title,
        description,
        inputSchema,
        annotations,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Aave MCP is unavailable.' },
      { status: 502 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const payload = callSchema.parse(await request.json());
    const tools = await listAaveTools(request.signal);
    const tool = tools.find((candidate) => candidate.name === payload.name);
    if (!tool) return NextResponse.json({ error: 'UNKNOWN_AAVE_TOOL' }, { status: 404 });

    // GOL may inspect, simulate, and build unsigned requests. Relaying an already-signed order is a
    // separate wallet-authorized workflow and must never be exposed as an anonymous browser proxy.
    if (AAVE_SIGNED_RELAY_TOOLS.has(tool.name)) {
      return NextResponse.json(
        { error: 'SIGNED_RELAY_REQUIRES_AUTHENTICATED_WALLET_FLOW' },
        { status: 403 },
      );
    }

    const result = await callAaveTool(payload.name, payload.arguments, request.signal);
    return NextResponse.json({ tool: payload.name, result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'INVALID_AAVE_TOOL_CALL', issues: error.issues },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Aave MCP is unavailable.' },
      { status: 502 },
    );
  }
}
