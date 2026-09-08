import { createHash, randomUUID } from 'node:crypto';
import type { Address, Hex32, RequestState } from '@gol/protocol';
import type { Pool, PoolClient } from 'pg';

export interface JournalRequest {
  id: string;
  userSubject: string;
  account: Address;
  mandateId: string;
  requestId: Hex32;
  inputHash: string;
  text: string;
  parsedRecipient: Address | null;
  parsedAmount: string | null;
  state: RequestState;
  providerOperationId: string | null;
  txHash: Hex32 | null;
  rule: string | null;
  attemptedUnits: string | null;
  headroomUnits: string | null;
  errorCode: string | null;
  leaseOwner: string | null;
}

export class RequestConflictError extends Error {
  readonly code = 'REQUEST_CONFLICT';
}

export class RequestNotFoundError extends Error {
  readonly code = 'REQUEST_NOT_FOUND';
}

export class PgJournal {
  constructor(private readonly pool: Pool) {}

  async enqueue(input: {
    userSubject: string;
    account: Address;
    mandateId: string;
    requestId: Hex32;
    text: string;
  }): Promise<JournalRequest> {
    const text = input.text.trim();
    const inputHash = hashInput(input.account, input.mandateId, input.requestId, text);
    const inserted = await this.pool.query(
      `INSERT INTO requests
        (id, user_subject, account_address, mandate_id, request_id, input_hash, text, state)
       SELECT $1, user_subject, account_address, $4, $5, $6, $7, 'queued'
       FROM account_links
       WHERE user_subject = $2 AND lower(account_address) = lower($3)
       ON CONFLICT (account_address, mandate_id, request_id) DO NOTHING
       RETURNING *`,
      [
        randomUUID(),
        input.userSubject,
        input.account,
        input.mandateId,
        input.requestId,
        inputHash,
        text,
      ],
    );
    if (inserted.rowCount === 1) return mapRow(inserted.rows[0]);

    const existing = await this.pool.query(
      `SELECT * FROM requests
       WHERE user_subject = $1 AND lower(account_address) = lower($2)
         AND mandate_id = $3 AND lower(request_id) = lower($4)`,
      [input.userSubject, input.account, input.mandateId, input.requestId],
    );
    if (existing.rowCount !== 1)
      throw new RequestNotFoundError('Account or request is not available');
    const row = mapRow(existing.rows[0]);
    if (row.inputHash !== inputHash)
      throw new RequestConflictError('Request ID has different input');
    return row;
  }

  async getForUser(userSubject: string, requestId: Hex32): Promise<JournalRequest> {
    const result = await this.pool.query(
      'SELECT * FROM requests WHERE user_subject = $1 AND lower(request_id) = lower($2)',
      [userSubject, requestId],
    );
    if (result.rowCount !== 1) throw new RequestNotFoundError('Request is not available');
    return mapRow(result.rows[0]);
  }

  async claimNext(workerId: string, leaseSeconds = 30): Promise<JournalRequest | null> {
    return this.transaction(async (client) => {
      const result = await client.query(
        `WITH candidate AS (
           SELECT r.id
           FROM requests r
           JOIN account_links a USING (account_address)
           WHERE (
             r.state IN ('queued', 'signing', 'submitted', 'pending')
             OR (r.state = 'unknown' AND (r.tx_hash IS NOT NULL OR r.provider_operation_id IS NOT NULL))
           )
             AND (r.lease_until IS NULL OR r.lease_until < now())
             AND pg_try_advisory_xact_lock(hashtextextended(a.agent_address, 0))
           ORDER BY r.created_at
           FOR UPDATE OF r SKIP LOCKED
           LIMIT 1
         )
         UPDATE requests r
         SET lease_owner = $1, lease_until = now() + make_interval(secs => $2), updated_at = now()
         FROM candidate
         WHERE r.id = candidate.id
         RETURNING r.*`,
        [workerId, leaseSeconds],
      );
      return result.rowCount === 1 ? mapRow(result.rows[0]) : null;
    });
  }

  async recordSubmission(
    id: string,
    workerId: string,
    providerOperationId: string | null,
    txHash: Hex32,
  ): Promise<void> {
    await this.transaction(async (client) => {
      const updated = await client.query(
        `UPDATE requests SET state = 'submitted', provider_operation_id = $3, tx_hash = $4,
           updated_at = now()
         WHERE id = $1 AND lease_owner = $2`,
        [id, workerId, providerOperationId, txHash],
      );
      if (updated.rowCount !== 1) throw new Error('LEASE_LOST');
      await client.query(
        `INSERT INTO request_transactions (request_row_id, tx_hash) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [id, txHash],
      );
    });
  }

  async markSigning(
    id: string,
    workerId: string,
    recipient: Address,
    amountUnits: string,
  ): Promise<void> {
    const updated = await this.pool.query(
      `UPDATE requests SET state = 'signing', parsed_recipient = $3, parsed_amount = $4,
         attempted_units = $4, updated_at = now()
       WHERE id = $1 AND lease_owner = $2 AND state = 'queued'`,
      [id, workerId, recipient, amountUnits],
    );
    if (updated.rowCount !== 1) throw new Error('LEASE_LOST');
  }

  async finish(
    id: string,
    workerId: string,
    result: {
      state: Extract<
        RequestState,
        | 'needs_clarification'
        | 'executed'
        | 'refused'
        | 'signer_blocked'
        | 'technical_failure'
        | 'unknown'
      >;
      rule?: string | null;
      attemptedUnits?: string | null;
      headroomUnits?: string | null;
      errorCode?: string | null;
    },
  ): Promise<void> {
    const updated = await this.pool.query(
      `UPDATE requests SET state = $3, rule = $4, attempted_units = $5, headroom_units = $6,
         error_code = $7, lease_owner = NULL, lease_until = NULL, updated_at = now()
       WHERE id = $1 AND lease_owner = $2`,
      [
        id,
        workerId,
        result.state,
        result.rule ?? null,
        result.attemptedUnits ?? null,
        result.headroomUnits ?? null,
        result.errorCode ?? null,
      ],
    );
    if (updated.rowCount !== 1) throw new Error('LEASE_LOST');
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  private async transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

export function hashInput(
  account: Address,
  mandateId: string,
  requestId: Hex32,
  text: string,
): string {
  return createHash('sha256')
    .update(JSON.stringify([account.toLowerCase(), mandateId, requestId.toLowerCase(), text]))
    .digest('hex');
}

function mapRow(row: Record<string, unknown>): JournalRequest {
  return {
    id: String(row.id),
    userSubject: String(row.user_subject),
    account: String(row.account_address).trim() as Address,
    mandateId: String(row.mandate_id),
    requestId: String(row.request_id).trim() as Hex32,
    inputHash: String(row.input_hash).trim(),
    text: String(row.text),
    parsedRecipient: row.parsed_recipient ? (String(row.parsed_recipient).trim() as Address) : null,
    parsedAmount: row.parsed_amount ? String(row.parsed_amount) : null,
    state: String(row.state) as RequestState,
    providerOperationId: row.provider_operation_id ? String(row.provider_operation_id) : null,
    txHash: row.tx_hash ? (String(row.tx_hash).trim() as Hex32) : null,
    rule: row.rule ? String(row.rule) : null,
    attemptedUnits: row.attempted_units ? String(row.attempted_units) : null,
    headroomUnits: row.headroom_units ? String(row.headroom_units) : null,
    errorCode: row.error_code ? String(row.error_code) : null,
    leaseOwner: row.lease_owner ? String(row.lease_owner) : null,
  };
}
