import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Address, Hex32 } from '@gol/protocol';
import { PgJournal, RequestConflictError, RequestNotFoundError } from '../src/db/journal.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const ACCOUNT = '0x0000000000000000000000000000000000acc017' as Address;
const OWNER = '0x00000000000000000000000000000000000a11ce';
const AGENT = '0x00000000000000000000000000000000000a6e17';
const REQUEST = `0x${'01'.repeat(32)}` as Hex32;

describe.runIf(databaseUrl)('PostgreSQL request journal', () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const journal = new PgJournal(pool);

  beforeAll(async () => {
    const schema = await readFile(
      fileURLToPath(new URL('../src/db/schema.sql', import.meta.url)),
      'utf8',
    );
    await pool.query(schema);
    await pool.query('TRUNCATE request_transactions, requests, recipients, account_links CASCADE');
    await pool.query(
      `INSERT INTO account_links
       (user_subject, owner_address, account_address, agent_wallet_id, agent_address, policy_id)
       VALUES ('user-1', $1, $2, 'wallet-1', $3, 'policy-1')`,
      [OWNER, ACCOUNT, AGENT],
    );
  });

  afterAll(async () => journal.close());

  it('returns the same row for an exact duplicate and rejects changed input', async () => {
    const input = {
      userSubject: 'user-1',
      account: ACCOUNT,
      mandateId: '1',
      requestId: REQUEST,
      text: 'Pay 40 USDC to Design contractor',
    };
    const first = await journal.enqueue(input);
    const duplicate = await journal.enqueue(input);
    expect(duplicate.id).toBe(first.id);
    await expect(
      journal.enqueue({ ...input, text: 'Pay 41 USDC to Design contractor' }),
    ).rejects.toBeInstanceOf(RequestConflictError);
  });

  it('does not reveal another user request', async () => {
    await expect(journal.getForUser('user-2', REQUEST)).rejects.toBeInstanceOf(
      RequestNotFoundError,
    );
  });

  it('allows only one worker to claim a row and preserves an accepted submission', async () => {
    const [a, b] = await Promise.all([
      journal.claimNext('worker-a'),
      journal.claimNext('worker-b'),
    ]);
    const claimed = a ?? b;
    expect(claimed).not.toBeNull();
    expect([a, b].filter(Boolean)).toHaveLength(1);

    await journal.recordSubmission(
      claimed!.id,
      claimed!.leaseOwner!,
      'operation-1',
      `0x${'ab'.repeat(32)}`,
    );
    await pool.query(
      "UPDATE requests SET lease_until = now() - interval '1 second' WHERE id = $1",
      [claimed!.id],
    );
    const recovered = await journal.claimNext('worker-recovery');
    expect(recovered).toMatchObject({ state: 'submitted', providerOperationId: 'operation-1' });
    expect(recovered!.txHash).toBe(`0x${'ab'.repeat(32)}`);
  });
});
