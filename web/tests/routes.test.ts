import { beforeEach, describe, expect, it, vi } from 'vitest';

const query = vi.fn();
vi.mock('@/server/core', async () => {
  const actual = await vi.importActual<typeof import('@/server/core')>('@/server/core');
  return {
    ...actual,
    pool: { query },
    authenticate: vi.fn(async () => ({ subject: 'owner-a', developer: true })),
    requireWriteOrigin: vi.fn(),
    rateLimit: vi.fn(),
  };
});

vi.mock('@gol/agent/db', () => ({
  PgJournal: class {
    async enqueue(value: unknown) {
      return { ...(value as object), state: 'queued' };
    }
    async getForUser() {
      throw Object.assign(new Error('hidden'), { code: 'REQUEST_NOT_FOUND' });
    }
  },
}));

describe('server routes', () => {
  beforeEach(() => query.mockReset());

  it('binds instructions to the authenticated account', async () => {
    query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ account_address: '0x1111111111111111111111111111111111111111' }],
    });
    const { POST } = await import('../app/api/instructions/route');
    const response = await POST(
      new Request('https://gol.test/api/instructions', {
        method: 'POST',
        body: JSON.stringify({
          account: '0x2222222222222222222222222222222222222222',
          mandateId: '1',
          requestId: `0x${'1'.repeat(64)}`,
          text: 'Pay 1 USDC to vendor',
        }),
      }),
    );
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'ACCOUNT_SCOPE_MISMATCH' });
  });

  it('rejects instructions until the owner explicitly confirms a recipient', async () => {
    query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [
        {
          account_address: '0x1111111111111111111111111111111111111111',
          recipient_confirmed: false,
        },
      ],
    });
    const { POST } = await import('../app/api/instructions/route');
    const response = await POST(
      new Request('https://gol.test/api/instructions', {
        method: 'POST',
        body: JSON.stringify({
          account: '0x1111111111111111111111111111111111111111',
          mandateId: '1',
          requestId: `0x${'3'.repeat(64)}`,
          text: 'Pay 1 USDC to vendor',
        }),
      }),
    );
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: 'RECIPIENT_CONFIRMATION_REQUIRED',
    });
  });

  it('does not expose another user request', async () => {
    const { GET } = await import('../app/api/requests/[requestId]/route');
    const response = await GET(new Request('https://gol.test/api/requests/id'), {
      params: Promise.resolve({ requestId: `0x${'2'.repeat(64)}` }),
    });
    expect(response.status).toBe(404);
  });

  it('keeps the public demo endpoint read-only', async () => {
    const route = await import('../app/api/demo/route');
    expect('POST' in route).toBe(false);
    const value = await route.GET().json();
    expect(value.interactive).toBe(false);
  });
});
