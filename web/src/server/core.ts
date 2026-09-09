import 'server-only';

import { verifyAccessToken } from '@privy-io/node';
import { Pool } from 'pg';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { EnvironmentError, runtimeConfig } from './env';

const globalPool = globalThis as typeof globalThis & { golPool?: Pool };
export const pool =
  globalPool.golPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
  });
if (process.env.NODE_ENV !== 'production') globalPool.golPool = pool;

export interface Session {
  subject: string;
  developer: boolean;
}

export async function authenticate(request: Request): Promise<Session> {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) throw new HttpError(401, 'AUTH_REQUIRED');
  const { server } = runtimeConfig();
  if (server.developerToken && constantTimeEqual(token, server.developerToken)) {
    return { subject: server.developerSubject, developer: true };
  }
  const appId = server.privyAppId;
  const verificationKey = server.privyVerificationKey;
  if (!appId || !verificationKey) throw new HttpError(503, 'AUTH_UNAVAILABLE');
  try {
    const verified = await verifyAccessToken({
      access_token: token,
      app_id: appId,
      verification_key: verificationKey,
    });
    return { subject: verified.user_id, developer: false };
  } catch {
    throw new HttpError(401, 'INVALID_SESSION');
  }
}

export function requireWriteOrigin(request: Request, session: Session): void {
  if (session.developer) return;
  const configured = runtimeConfig().server.appOrigin;
  if (!configured || request.headers.get('origin') !== configured) {
    throw new HttpError(403, 'ORIGIN_DENIED');
  }
}

export async function readJson(request: Request): Promise<unknown> {
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > 16_384) throw new HttpError(413, 'BODY_TOO_LARGE');
  const text = await request.text();
  if (Buffer.byteLength(text, 'utf8') > 16_384) throw new HttpError(413, 'BODY_TOO_LARGE');
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new HttpError(400, 'INVALID_JSON');
  }
}

const limits = new Map<string, number[]>();
export function rateLimit(key: string, maximum: number): void {
  const now = Date.now();
  const recent = (limits.get(key) ?? []).filter((timestamp) => timestamp > now - 60_000);
  if (recent.length >= maximum) throw new HttpError(429, 'RATE_LIMITED');
  recent.push(now);
  limits.set(key, recent);
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

export function errorResponse(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return NextResponse.json({ error: 'INVALID_REQUEST' }, { status: 400 });
  }
  if (error instanceof EnvironmentError) {
    // Field names only. A configuration value may itself be a secret.
    return NextResponse.json(
      { error: 'INVALID_ENVIRONMENT', fields: error.issues.map((issue) => issue.field) },
      { status: 503 },
    );
  }
  if (error instanceof HttpError) {
    return NextResponse.json({ error: error.code }, { status: error.status });
  }
  const code = error instanceof Error && 'code' in error ? String(error.code) : 'INTERNAL_ERROR';
  const status = code === 'REQUEST_CONFLICT' ? 409 : code === 'REQUEST_NOT_FOUND' ? 404 : 500;
  return NextResponse.json({ error: code }, { status });
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index++) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}
