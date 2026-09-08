import { afterEach, describe, expect, it } from 'vitest';
import { authenticate, HttpError, readJson, requireWriteOrigin } from '@/server/core';

const original = { ...process.env };

afterEach(() => {
  process.env = { ...original };
});

describe('HTTP authority boundary', () => {
  it('requires a bearer session', async () => {
    await expect(authenticate(new Request('https://gol.test/api/account'))).rejects.toMatchObject({
      status: 401,
      code: 'AUTH_REQUIRED',
    });
  });

  it('accepts only the constant-time developer token in local automation', async () => {
    process.env.GOL_DEV_TOKEN = 'local-test-token';
    process.env.GOL_DEV_SUBJECT = 'fixture-owner';
    const request = new Request('https://gol.test/api/account', {
      headers: { authorization: 'Bearer local-test-token' },
    });
    await expect(authenticate(request)).resolves.toEqual({
      subject: 'fixture-owner',
      developer: true,
    });
  });

  it('rejects a cross-origin browser write', () => {
    process.env.APP_ORIGIN = 'https://gol.test';
    const request = new Request('https://gol.test/api/instructions', {
      method: 'POST',
      headers: { origin: 'https://attacker.test' },
    });
    expect(() => requireWriteOrigin(request, { subject: 'owner', developer: false })).toThrowError(
      HttpError,
    );
  });

  it('rejects a body larger than 16KB', async () => {
    const request = new Request('https://gol.test/api/instructions', {
      method: 'POST',
      body: JSON.stringify({ text: 'x'.repeat(17_000) }),
    });
    await expect(readJson(request)).rejects.toMatchObject({ status: 413, code: 'BODY_TOO_LARGE' });
  });
});
