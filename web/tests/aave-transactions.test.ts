import { describe, expect, it, vi } from 'vitest';
import {
  extractPreparedAaveReview,
  type PreparedAaveTransaction,
} from '../src/client/aave-transactions';
import { sendPreparedTransaction, type OwnerProvider } from '../src/wallet/owner-actions';

const OWNER = '0x28C6c06298d514Db089934071355E5743bf21d60';
const TARGET = '0x973a023A77420ba610f06b3858aD991Df6d85A08';
const HASH = `0x${'12'.repeat(32)}` as `0x${string}`;

function transaction(overrides: Partial<PreparedAaveTransaction> = {}): PreparedAaveTransaction {
  return {
    to: TARGET,
    from: OWNER,
    data: '0x852a56a5',
    value: '0',
    chainId: 1,
    operations: ['SPOKE_SUPPLY'],
    ...overrides,
  };
}

describe('prepared Aave transaction boundary', () => {
  it('extracts a direct unsigned transaction', () => {
    const review = extractPreparedAaveReview({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            data: { __typename: 'TransactionRequest', ...transaction() },
            next_actions: ['Review before signing.'],
          }),
        },
      ],
    });

    expect(review).toMatchObject({
      step: 'action',
      transaction: { to: TARGET, chainId: 1, operations: ['SPOKE_SUPPLY'] },
    });
  });

  it('selects only the approval transaction from an approval-required result', () => {
    const approval = transaction({ to: OWNER, data: '0x095ea7b3', operations: [] });
    const review = extractPreparedAaveReview({
      data: {
        __typename: 'Erc20ApprovalRequired',
        approvals: [{ byTransaction: { __typename: 'TransactionRequest', ...approval } }],
        originalTransaction: { __typename: 'TransactionRequest', ...transaction() },
        warnings: [{ message: 'Approval required.' }],
      },
    });

    expect(review?.step).toBe('approval');
    expect(review?.transaction.to).toBe(OWNER);
    expect(review?.warnings).toEqual(['Approval required.']);
  });

  it('rejects malformed calldata and unsupported chains', () => {
    expect(
      extractPreparedAaveReview({
        data: { __typename: 'TransactionRequest', ...transaction(), data: 'not-hex' },
      }),
    ).toBeNull();
    expect(
      extractPreparedAaveReview({
        data: { __typename: 'TransactionRequest', ...transaction(), chainId: 5042002 },
      }),
    ).toBeNull();
  });

  it('submits only after matching the connected owner and confirms the receipt', async () => {
    const request = vi.fn(async ({ method }: { method: string }) => {
      if (method === 'eth_chainId') return '0x1';
      if (method === 'eth_requestAccounts') return [OWNER];
      if (method === 'eth_sendTransaction') return HASH;
      if (method === 'eth_getTransactionReceipt') return { status: '0x1' };
      throw new Error(`Unexpected method ${method}`);
    });
    const reports: Array<{ phase: string; hash?: string | null }> = [];

    await expect(
      sendPreparedTransaction({ request } as OwnerProvider, transaction(), (update) =>
        reports.push(update),
      ),
    ).resolves.toBe(HASH);
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'eth_sendTransaction' }),
    );
    expect(reports.map((report) => report.phase)).toEqual([
      'awaiting_signature',
      'submitted',
      'confirmed',
    ]);
  });

  it('refuses a transaction prepared for a different wallet', async () => {
    const request = vi.fn(async ({ method }: { method: string }) => {
      if (method === 'eth_chainId') return '0x1';
      if (method === 'eth_requestAccounts') {
        return ['0xC0FFEe0000000000000000000000000000000001'];
      }
      throw new Error(`Unexpected method ${method}`);
    });

    await expect(
      sendPreparedTransaction({ request } as OwnerProvider, transaction(), () => undefined),
    ).rejects.toThrow('different wallet');
    expect(request).not.toHaveBeenCalledWith(
      expect.objectContaining({ method: 'eth_sendTransaction' }),
    );
  });
});
