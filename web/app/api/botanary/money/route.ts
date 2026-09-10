import { createHash } from 'node:crypto';
import { z } from 'zod';
import { runtimeConfig } from '@/server/env';

export const runtime = 'nodejs';

const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
const hash = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
const token = z.object({ symbol: z.string().min(1).max(20), address, chainId: z.number().int() });
const swap = z.object({
  chainId: z.number().int().positive(),
  fromToken: token,
  toToken: token,
  amountIn: z.number().positive(),
  maxSlippageBps: z.number().int().min(1).max(5_000),
  gasMethod: z.literal('native'),
});

const requestSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('account-ensure'),
    payload: z.object({ chainId: z.number().int().positive() }),
  }),
  z.object({
    action: z.literal('tokens'),
    payload: z.object({ chainId: z.number().int().positive() }),
  }),
  z.object({ action: z.literal('quote'), payload: swap.omit({ gasMethod: true }) }),
  z.object({ action: z.literal('swap-build'), payload: swap }),
  z.object({
    action: z.literal('send-build'),
    payload: z.object({
      chainId: z.number().int().positive(),
      transfers: z
        .array(
          z.object({
            token,
            amount: z.number().positive(),
            amountRaw: z.string().regex(/^\d+$/),
            to: address,
          }),
        )
        .min(1)
        .max(5),
      gasMethod: z.literal('native'),
    }),
  }),
  z.object({
    action: z.literal('receive'),
    payload: z.object({ chainId: z.number().int().positive(), token: z.string().min(1).max(20) }),
  }),
  z.object({
    action: z.literal('relay'),
    payload: z.object({
      userOp: z.record(z.string(), z.unknown()),
      userOpHash: hash,
      intentType: z.string().min(1).max(80),
    }),
  }),
  z.object({ action: z.literal('receipt'), payload: z.object({ id: z.string().min(1).max(160) }) }),
  z.object({
    action: z.literal('bridge-status'),
    payload: z.object({
      txHash: hash,
      fromChainId: z.number().int().positive(),
      toChainId: z.number().int().positive(),
    }),
  }),
]);

type ActionRequest = z.infer<typeof requestSchema>;

interface CachedSession {
  token: string;
  expiresAt: number;
}

class SessionExchangeError extends Error {
  constructor(readonly status: number) {
    super('BOTANARY_SESSION_FAILED');
  }
}

const sessionCache = new Map<string, CachedSession>();
const MAX_SESSIONS = 500;

function sessionKey(baseUrl: string, privyToken: string) {
  return createHash('sha256').update(baseUrl).update('\0').update(privyToken).digest('hex');
}

function jwtExpiry(token: string): number | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      exp?: unknown;
    };
    return typeof decoded.exp === 'number' && Number.isFinite(decoded.exp)
      ? decoded.exp * 1_000
      : null;
  } catch {
    return null;
  }
}

function routeFor(input: ActionRequest): { path: string; method: 'GET' | 'POST'; body?: unknown } {
  switch (input.action) {
    case 'account-ensure':
      return {
        path: '/account',
        method: 'POST',
        body: { label: 'GOL actions', chainId: input.payload.chainId },
      };
    case 'tokens':
      return { path: `/money/swap/tokens?chainId=${input.payload.chainId}`, method: 'GET' };
    case 'quote':
      return { path: '/money/swap/quote', method: 'POST', body: input.payload };
    case 'swap-build':
      return { path: '/money/swap/build', method: 'POST', body: input.payload };
    case 'send-build':
      return { path: '/money/send/build', method: 'POST', body: input.payload };
    case 'receive':
      return {
        path: `/money/receive?chainId=${input.payload.chainId}&token=${encodeURIComponent(input.payload.token)}`,
        method: 'GET',
      };
    case 'relay':
      return { path: '/userops', method: 'POST', body: input.payload };
    case 'receipt':
      return { path: `/userops/${encodeURIComponent(input.payload.id)}`, method: 'GET' };
    case 'bridge-status':
      return {
        path: `/money/swap/status?txHash=${input.payload.txHash}&fromChainId=${input.payload.fromChainId}&toChainId=${input.payload.toChainId}`,
        method: 'GET',
      };
  }
}

async function responseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > 2_000_000) {
    throw new Error('BOTANARY_RESPONSE_TOO_LARGE');
  }
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { error: 'BOTANARY_INVALID_RESPONSE' };
  }
}

async function botanarySession(baseUrl: string, privyToken: string, signal: AbortSignal) {
  const key = sessionKey(baseUrl, privyToken);
  const cached = sessionCache.get(key);
  if (cached && cached.expiresAt > Date.now() + 5_000) return { key, token: cached.token };
  sessionCache.delete(key);

  const exchange = await fetch(`${baseUrl}/auth/session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ privyToken }),
    cache: 'no-store',
    signal,
  });
  const session = (await responseBody(exchange)) as {
    sessionToken?: unknown;
    expiresAt?: unknown;
  } | null;
  if (!exchange.ok || typeof session?.sessionToken !== 'string') {
    throw new SessionExchangeError(exchange.status || 502);
  }

  const declaredExpiry =
    typeof session.expiresAt === 'string' ? Date.parse(session.expiresAt) : Number.NaN;
  const sessionExpiry = Number.isFinite(declaredExpiry) ? declaredExpiry : Date.now() + 5 * 60_000;
  // Never let the exchanged session outlive the Privy credential that authorized it. Decoding `exp`
  // is safe here because Botanary already verified this exact token before issuing the session.
  const expiresAt = Math.min(sessionExpiry, jwtExpiry(privyToken) ?? Date.now() + 60_000);
  if (sessionCache.size >= MAX_SESSIONS) {
    const oldest = sessionCache.keys().next().value as string | undefined;
    if (oldest) sessionCache.delete(oldest);
  }
  if (expiresAt > Date.now() + 5_000) {
    sessionCache.set(key, { token: session.sessionToken, expiresAt });
  }
  return { key, token: session.sessionToken };
}

export async function POST(request: Request) {
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > 32_768) return Response.json({ error: 'BODY_TOO_LARGE' }, { status: 413 });

  const privyToken = request.headers
    .get('authorization')
    ?.replace(/^Bearer\s+/i, '')
    .trim();
  if (!privyToken) return Response.json({ error: 'AUTH_REQUIRED' }, { status: 401 });

  let input: ActionRequest;
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > 32_768) {
      return Response.json({ error: 'BODY_TOO_LARGE' }, { status: 413 });
    }
    input = requestSchema.parse(JSON.parse(text));
  } catch {
    return Response.json({ error: 'INVALID_MONEY_REQUEST' }, { status: 400 });
  }

  const baseUrl = runtimeConfig().server.botanaryApiUrl?.replace(/\/$/, '');
  if (!baseUrl) return Response.json({ error: 'BOTANARY_NOT_CONFIGURED' }, { status: 503 });

  try {
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(30_000)]);
    const upstream = routeFor(input);
    const upstreamBody = upstream.body ? JSON.stringify(upstream.body) : undefined;
    const callUpstream = (sessionToken: string) =>
      fetch(`${baseUrl}${upstream.path}`, {
        method: upstream.method,
        headers: {
          authorization: `Bearer ${sessionToken}`,
          ...(upstreamBody ? { 'content-type': 'application/json' } : {}),
        },
        ...(upstreamBody ? { body: upstreamBody } : {}),
        cache: 'no-store',
        signal,
      });

    let session = await botanarySession(baseUrl, privyToken, signal);
    let response = await callUpstream(session.token);
    if (response.status === 401) {
      sessionCache.delete(session.key);
      session = await botanarySession(baseUrl, privyToken, signal);
      response = await callUpstream(session.token);
    }
    const body = await responseBody(response);
    return Response.json(body, { status: response.status });
  } catch (error) {
    if (error instanceof SessionExchangeError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    const code = error instanceof Error ? error.message : 'BOTANARY_UNAVAILABLE';
    return Response.json(
      { error: code === 'BOTANARY_RESPONSE_TOO_LARGE' ? code : 'BOTANARY_UNAVAILABLE' },
      { status: 502 },
    );
  }
}
