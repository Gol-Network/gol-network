import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBotanaryMoneyClient } from '../src/client/botanary-money';
import type { MoneySendInput, MoneySwapInput, TransactionReporter } from '../src/client/types';

const USDC = {
  symbol: 'USDC',
  address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  chainId: 84532,
} as const;
const ETH = {
  symbol: 'ETH',
  address: '0x0000000000000000000000000000000000000000',
  chainId: 84532,
} as const;
const BASE_USDC = {
  symbol: 'USDC',
  address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  chainId: 8453,
  decimals: 6,
} as const;
const HASH = `0x${'12'.repeat(32)}` as const;
const SIGNATURE = `0x${'34'.repeat(64)}1b` as const;
const USER_OP = {
  sender: '0xC0FFee0000000000000000000000000000000001',
  nonce: '0',
  callData: '0x',
  callGasLimit: '200000',
  verificationGasLimit: '150000',
  preVerificationGas: '50000',
  maxFeePerGas: '1000000000',
  maxPriorityFeePerGas: '1000000000',
  signature: '0x',
  entryPoint: '0x0000000000000000000000000000000000000007',
  chainId: 84532,
};

function build(intentType: string, willSucceed = true) {
  return {
    intentType,
    userOp: USER_OP,
    userOpHash: HASH,
    simulation: { willSucceed, warnings: willSucceed ? [] : ['Balance is too low.'] },
  };
}

function included() {
  return {
    id: 'op-1',
    userOpHash: HASH,
    status: 'included',
    txHash: HASH,
    error: null,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('Botanary money proxy', () => {
  it('rejects non-allowlisted operations before any upstream call', async () => {
    vi.stubEnv('BOTANARY_API_URL', 'http://127.0.0.1:3010/v1');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { POST } = await import('../app/api/botanary/money/route');

    const response = await POST(
      new Request('https://gol.test/api/botanary/money', {
        method: 'POST',
        headers: { authorization: 'Bearer privy-jwt', 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'arbitrary-fetch',
          payload: { url: 'https://example.com' },
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('derives an idempotent account record before requesting a first quote', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ account: { id: 'account-1' } }))
      .mockResolvedValueOnce(
        Response.json({
          supported: true,
          crossChain: false,
          amountOut: { symbol: 'ETH', amount: 0.001 },
          amountOutMin: { symbol: 'ETH', amount: 0.00099 },
          rate: 0.0001,
          route: [],
          fees: [],
          slippageBps: 100,
        }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const client = createBotanaryMoneyClient({
      getAccessToken: async () => 'privy-jwt',
      ownerProvider: async () => ({ request: async () => null }),
    });
    const input: MoneySwapInput = {
      fromChainId: 84532,
      toChainId: 84532,
      fromToken: { ...USDC, decimals: 6 },
      toToken: { ...ETH, decimals: 18 },
      amount: '10',
      maxSlippageBps: 100,
    };

    await expect(client.quote(input)).resolves.toMatchObject({ supported: true });
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      action: 'account-ensure',
      payload: { chainId: 84532 },
    });
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toMatchObject({
      action: 'quote',
      payload: { chainId: 84532, amountIn: 10 },
    });
  });

  it('builds, simulates, signs, and relays a send with exact token units', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ account: { id: 'account-1' } }))
      .mockResolvedValueOnce(Response.json(build('send')))
      .mockResolvedValueOnce(Response.json(included()));
    const request = vi.fn().mockResolvedValue(SIGNATURE);
    const report = vi.fn<TransactionReporter>();
    vi.stubGlobal('fetch', fetchMock);
    const client = createBotanaryMoneyClient({
      getAccessToken: async () => 'privy-send-jwt',
      ownerProvider: async () => ({ request }),
    });
    const input: MoneySendInput = {
      chainId: 84532,
      token: { ...USDC, decimals: 6 },
      amount: '1.234567',
      recipient: '0xbEef000000000000000000000000000000000004',
    };

    await expect(client.send(input, report)).resolves.toEqual({ txHash: HASH });
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toMatchObject({
      action: 'send-build',
      payload: { transfers: [{ amount: 1.234567, amountRaw: '1234567' }] },
    });
    expect(request).toHaveBeenCalledWith({
      method: 'secp256k1_sign',
      params: [expect.stringMatching(/^0x[0-9a-f]{64}$/)],
    });
    expect(JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body))).toMatchObject({
      action: 'relay',
      payload: { userOp: { signature: SIGNATURE }, userOpHash: HASH, intentType: 'send' },
    });
    expect(report.mock.calls.map(([update]) => update.phase)).toEqual([
      'awaiting_signature',
      'submitted',
      'confirmed',
    ]);
  });

  it('never opens the wallet or relays when Botanary simulation rejects the action', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ account: { id: 'account-1' } }))
      .mockResolvedValueOnce(Response.json(build('send', false)));
    const ownerProvider = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const client = createBotanaryMoneyClient({
      getAccessToken: async () => 'privy-simulation-jwt',
      ownerProvider,
    });

    await expect(
      client.send(
        {
          chainId: 84532,
          token: { ...USDC, decimals: 6 },
          amount: '10',
          recipient: '0xbEef000000000000000000000000000000000004',
        },
        vi.fn(),
      ),
    ).rejects.toThrow('Balance is too low.');
    expect(ownerProvider).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('reports a cancelled owner signature and does not relay it', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ account: { id: 'account-1' } }))
      .mockResolvedValueOnce(Response.json(build('send')));
    const report = vi.fn<TransactionReporter>();
    vi.stubGlobal('fetch', fetchMock);
    const client = createBotanaryMoneyClient({
      getAccessToken: async () => 'privy-cancel-jwt',
      ownerProvider: async () => ({
        request: async () => {
          throw new Error('User rejected');
        },
      }),
    });

    await expect(
      client.send(
        {
          chainId: 84532,
          token: { ...USDC, decimals: 6 },
          amount: '10',
          recipient: '0xbEef000000000000000000000000000000000004',
        },
        report,
      ),
    ).rejects.toThrow('User rejected');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(report.mock.calls.at(-1)?.[0]).toMatchObject({ phase: 'rejected' });
  });

  it('tracks a cross-chain action through destination delivery', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ account: { id: 'account-1' } }))
      .mockResolvedValueOnce(Response.json(build('swap')))
      .mockResolvedValueOnce(Response.json(included()))
      .mockResolvedValueOnce(
        Response.json({
          state: 'delivered',
          destTxHash: HASH,
          message: 'Funds arrived on Base.',
          explorerUrl: `https://basescan.org/tx/${HASH}`,
        }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const client = createBotanaryMoneyClient({
      getAccessToken: async () => 'privy-bridge-jwt',
      ownerProvider: async () => ({ request: async () => SIGNATURE }),
    });

    await expect(
      client.swap(
        {
          fromChainId: 84532,
          toChainId: 8453,
          fromToken: { ...USDC, decimals: 6 },
          toToken: BASE_USDC,
          amount: '10',
          maxSlippageBps: 50,
        },
        vi.fn(),
      ),
    ).resolves.toMatchObject({
      txHash: HASH,
      bridgeState: 'delivered',
      bridgeTxHash: HASH,
      bridgeExplorerUrl: `https://basescan.org/tx/${HASH}`,
      bridgeMessage: 'Funds arrived on Base.',
    });
  });

  it('exchanges the Privy JWT and forwards only the opaque Botanary session', async () => {
    vi.stubEnv('BOTANARY_API_URL', 'http://127.0.0.1:3010/v1');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ sessionToken: 'sess_private' }, { status: 201 }))
      .mockResolvedValueOnce(
        Response.json({
          supported: true,
          crossChain: false,
          amountOut: { symbol: 'ETH', amount: 0.001 },
          amountOutMin: { symbol: 'ETH', amount: 0.00099 },
          rate: 0.0001,
          route: [],
          fees: [],
          slippageBps: 100,
        }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const { POST } = await import('../app/api/botanary/money/route');

    const response = await POST(
      new Request('https://gol.test/api/botanary/money', {
        method: 'POST',
        headers: { authorization: 'Bearer privy-jwt', 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'quote',
          payload: {
            chainId: 84532,
            fromToken: USDC,
            toToken: ETH,
            amountIn: 10,
            maxSlippageBps: 100,
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://127.0.0.1:3010/v1/auth/session',
      expect.objectContaining({ body: JSON.stringify({ privyToken: 'privy-jwt' }) }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://127.0.0.1:3010/v1/money/swap/quote',
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: 'Bearer sess_private' }),
      }),
    );
    const secondRequest = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(JSON.stringify(secondRequest)).not.toContain('privy-jwt');
  });

  it('reuses an unexpired Botanary session without retaining the raw Privy token as a key', async () => {
    vi.stubEnv('BOTANARY_API_URL', 'http://127.0.0.1:3010/v1');
    const quote = {
      supported: true,
      crossChain: false,
      amountOut: { symbol: 'ETH', amount: 0.001 },
      amountOutMin: { symbol: 'ETH', amount: 0.00099 },
      rate: 0.0001,
      route: [],
      fees: [],
      slippageBps: 100,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json(
          { sessionToken: 'sess_cached', expiresAt: '2999-01-01T00:00:00.000Z' },
          { status: 201 },
        ),
      )
      .mockResolvedValueOnce(Response.json(quote))
      .mockResolvedValueOnce(Response.json(quote));
    vi.stubGlobal('fetch', fetchMock);
    const { POST } = await import('../app/api/botanary/money/route');
    const makeRequest = () =>
      new Request('https://gol.test/api/botanary/money', {
        method: 'POST',
        headers: { authorization: 'Bearer privy-cache-jwt', 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'quote',
          payload: {
            chainId: 84532,
            fromToken: USDC,
            toToken: ETH,
            amountIn: 10,
            maxSlippageBps: 100,
          },
        }),
      });

    await expect(POST(makeRequest())).resolves.toMatchObject({ status: 200 });
    await expect(POST(makeRequest())).resolves.toMatchObject({ status: 200 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://127.0.0.1:3010/v1/auth/session');
    expect(fetchMock.mock.calls[1]?.[0]).toBe('http://127.0.0.1:3010/v1/money/swap/quote');
    expect(fetchMock.mock.calls[2]?.[0]).toBe('http://127.0.0.1:3010/v1/money/swap/quote');
  });

  it('refreshes the Botanary session once when an upstream session is revoked', async () => {
    vi.stubEnv('BOTANARY_API_URL', 'http://127.0.0.1:3010/v1');
    const quote = {
      supported: true,
      crossChain: false,
      amountOut: { symbol: 'ETH', amount: 0.001 },
      amountOutMin: { symbol: 'ETH', amount: 0.00099 },
      rate: 0.0001,
      route: [],
      fees: [],
      slippageBps: 100,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ sessionToken: 'sess_revoked' }, { status: 201 }))
      .mockResolvedValueOnce(Response.json({ error: 'SESSION_REVOKED' }, { status: 401 }))
      .mockResolvedValueOnce(Response.json({ sessionToken: 'sess_fresh' }, { status: 201 }))
      .mockResolvedValueOnce(Response.json(quote));
    vi.stubGlobal('fetch', fetchMock);
    const { POST } = await import('../app/api/botanary/money/route');

    const response = await POST(
      new Request('https://gol.test/api/botanary/money', {
        method: 'POST',
        headers: { authorization: 'Bearer privy-refresh-jwt', 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'quote',
          payload: {
            chainId: 84532,
            fromToken: USDC,
            toToken: ETH,
            amountIn: 10,
            maxSlippageBps: 100,
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[3]?.[1]).toMatchObject({
      headers: expect.objectContaining({ authorization: 'Bearer sess_fresh' }),
    });
  });
});
