import { hashMessage, parseUnits, type Hex } from 'viem';
import { z } from 'zod';
import type {
  MoneyExecutionResult,
  MoneyReceiveInfo,
  MoneySendInput,
  MoneySwapInput,
  MoneySwapQuote,
  MoneyTokenOption,
  TransactionReporter,
} from './types';

interface EthereumProvider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}

interface BotanaryMoneyDependencies {
  getAccessToken: () => Promise<string | null>;
  ownerProvider: () => Promise<EthereumProvider>;
}

const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
const hash = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
const userOpSchema = z
  .object({
    sender: address,
    nonce: z.string(),
    callData: z.string().regex(/^0x[0-9a-fA-F]*$/),
    callGasLimit: z.string(),
    verificationGasLimit: z.string(),
    preVerificationGas: z.string(),
    maxFeePerGas: z.string(),
    maxPriorityFeePerGas: z.string(),
    signature: z.string().regex(/^0x[0-9a-fA-F]*$/),
    entryPoint: address,
    chainId: z.number().int().positive(),
  })
  .passthrough();
const buildSchema = z.object({
  intentType: z.string().min(1),
  userOp: userOpSchema,
  userOpHash: hash,
  simulation: z
    .object({
      willSucceed: z.boolean(),
      declineReason: z.string().nullish(),
      warnings: z.array(z.string()).default([]),
    })
    .nullish(),
});
const receiptSchema = z.object({
  id: z.string().min(1),
  userOpHash: hash,
  status: z.enum(['pending', 'included', 'failed']),
  txHash: hash.nullish(),
  error: z.string().nullish(),
});
const quoteSchema = z.object({
  supported: z.boolean(),
  crossChain: z.boolean(),
  amountOut: z.object({ symbol: z.string(), amount: z.number() }),
  amountOutMin: z.object({ symbol: z.string(), amount: z.number() }),
  rate: z.number(),
  priceImpactBps: z.number().nullish(),
  route: z.array(
    z.object({
      tool: z.string(),
      fromSymbol: z.string(),
      toSymbol: z.string(),
      fromChainId: z.number(),
      toChainId: z.number(),
    }),
  ),
  fees: z.array(z.object({ token: z.object({ symbol: z.string() }), amount: z.number() })),
  slippageBps: z.number(),
  estimatedDurationSec: z.number().nullish(),
  unsupportedReason: z.string().nullish(),
});
const receiveSchema = z.object({ address, uri: z.string().nullish() });
const tokenListSchema = z.array(
  z.object({
    symbol: z.string().min(1),
    name: z.string().min(1),
    address,
    decimals: z.number().int().min(0).max(36),
    chainId: z.number().int().positive(),
    priceUsd: z.number().nullish(),
    verified: z.boolean(),
    logoUri: z.string().nullish(),
  }),
);
const bridgeSchema = z.object({
  state: z.enum(['bridging', 'delivered', 'refunded', 'failed']),
  destTxHash: hash.nullish(),
  message: z.string().nullish(),
  explorerUrl: z.string().url().nullish(),
});

function errorMessage(value: unknown, status: number): string {
  if (value && typeof value === 'object' && 'message' in value) {
    const message = (value as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  if (value && typeof value === 'object' && 'error' in value) {
    const error = (value as { error?: unknown }).error;
    if (typeof error === 'string') return error.replaceAll('_', ' ').toLowerCase();
    if (error && typeof error === 'object' && 'message' in error) {
      const message = (error as { message?: unknown }).message;
      if (typeof message === 'string') return message;
    }
  }
  return `Botanary request failed with HTTP ${status}.`;
}

async function request(
  getAccessToken: () => Promise<string | null>,
  action: string,
  payload: unknown,
): Promise<unknown> {
  const token = await getAccessToken();
  if (!token) throw new Error('Sign in again before using owner money actions.');
  const response = await fetch('/api/botanary/money', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ action, payload }),
  });
  const value = (await response.json()) as unknown;
  if (!response.ok) throw new Error(errorMessage(value, response.status));
  return value;
}

function apiToken(token: MoneySwapInput['fromToken']) {
  return { symbol: token.symbol, address: token.address, chainId: token.chainId };
}

function swapBody(input: MoneySwapInput) {
  return {
    chainId: input.fromChainId,
    fromToken: apiToken(input.fromToken),
    toToken: apiToken(input.toToken),
    amountIn: Number(input.amount),
    maxSlippageBps: input.maxSlippageBps,
  };
}

function normalizeSignature(value: unknown): Hex {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{130}$/.test(value)) {
    throw new Error('The owner wallet returned an invalid signature.');
  }
  const recovery = Number.parseInt(value.slice(-2), 16);
  if (recovery >= 27) return value as Hex;
  return `${value.slice(0, -2)}${(recovery + 27).toString(16).padStart(2, '0')}` as Hex;
}

async function pause(milliseconds: number) {
  await new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

export function createBotanaryMoneyClient(dependencies: BotanaryMoneyDependencies) {
  const { getAccessToken, ownerProvider } = dependencies;

  async function ensureAccount(chainId: number): Promise<void> {
    // POST /account is idempotent. It derives or returns the counterfactual account record; the
    // first money UserOp carries the actual deployment prefix, so this step never signs by itself.
    await request(getAccessToken, 'account-ensure', { chainId });
  }

  async function buildSignRelay(
    action: 'send-build' | 'swap-build',
    payload: unknown,
    report: TransactionReporter,
  ): Promise<MoneyExecutionResult> {
    const build = buildSchema.parse(await request(getAccessToken, action, payload));
    if (build.simulation?.willSucceed === false) {
      throw new Error(
        build.simulation.warnings[0] ??
          build.simulation.declineReason ??
          'Botanary simulation rejected this action.',
      );
    }

    report({ phase: 'awaiting_signature', detail: 'Review and sign in the owner wallet.' });
    const provider = await ownerProvider();
    const digest = hashMessage({ raw: build.userOpHash as Hex });
    let signature: Hex;
    try {
      signature = normalizeSignature(
        await provider.request({ method: 'secp256k1_sign', params: [digest] }),
      );
    } catch (error) {
      report({ phase: 'rejected', detail: 'The owner signature was not completed.' });
      throw error;
    }

    const submitted = receiptSchema.parse(
      await request(getAccessToken, 'relay', {
        userOp: { ...build.userOp, signature },
        userOpHash: build.userOpHash,
        intentType: build.intentType,
      }),
    );
    report({ phase: 'submitted', hash: submitted.txHash ?? null, detail: 'Relayed to Botanary.' });

    let receipt = submitted;
    for (let attempt = 0; attempt < 45 && receipt.status === 'pending'; attempt += 1) {
      await pause(2_000);
      receipt = receiptSchema.parse(await request(getAccessToken, 'receipt', { id: submitted.id }));
    }
    if (receipt.status === 'failed') {
      report({
        phase: receipt.txHash ? 'reverted' : 'failed',
        hash: receipt.txHash ?? null,
        detail: receipt.error ?? 'The operation failed.',
      });
      throw new Error(receipt.error ?? 'The Botanary operation failed.');
    }
    if (receipt.status !== 'included') {
      report({
        phase: 'failed',
        detail: 'The operation is still pending. Check Activity before retrying.',
      });
      throw new Error('The operation is still pending. Check Activity before retrying.');
    }
    report({ phase: 'confirmed', hash: receipt.txHash ?? null, detail: 'Confirmed on-chain.' });
    return { txHash: receipt.txHash ?? null };
  }

  return {
    async tokens(chainId: number): Promise<MoneyTokenOption[]> {
      const listed = tokenListSchema.parse(await request(getAccessToken, 'tokens', { chainId }));
      return listed.map((token) => ({
        symbol: token.symbol,
        name: token.name,
        address: token.address as MoneyTokenOption['address'],
        decimals: token.decimals,
        chainId: token.chainId,
        verified: token.verified,
        priceUsd: token.priceUsd ?? null,
        logoUri: token.logoUri ?? null,
      }));
    },

    async quote(input: MoneySwapInput): Promise<MoneySwapQuote> {
      await ensureAccount(input.fromChainId);
      const quote = quoteSchema.parse(await request(getAccessToken, 'quote', swapBody(input)));
      return {
        supported: quote.supported,
        crossChain: quote.crossChain,
        amountOut: quote.amountOut,
        amountOutMin: quote.amountOutMin,
        rate: quote.rate,
        priceImpactBps: quote.priceImpactBps ?? null,
        route: quote.route,
        fees: quote.fees.map((fee) => ({ symbol: fee.token.symbol, amount: fee.amount })),
        slippageBps: quote.slippageBps,
        estimatedDurationSec: quote.estimatedDurationSec ?? null,
        unsupportedReason: quote.unsupportedReason ?? null,
      };
    },

    async send(input: MoneySendInput, report: TransactionReporter) {
      await ensureAccount(input.chainId);
      return buildSignRelay(
        'send-build',
        {
          chainId: input.chainId,
          transfers: [
            {
              token: apiToken(input.token),
              amount: Number(input.amount),
              amountRaw: parseUnits(input.amount, input.token.decimals).toString(),
              to: input.recipient,
            },
          ],
          gasMethod: 'native',
        },
        report,
      );
    },

    async swap(input: MoneySwapInput, report: TransactionReporter) {
      await ensureAccount(input.fromChainId);
      const result = await buildSignRelay(
        'swap-build',
        { ...swapBody(input), gasMethod: 'native' },
        report,
      );
      if (input.fromChainId === input.toChainId || !result.txHash) return result;

      for (let attempt = 0; attempt < 40; attempt += 1) {
        const bridge = bridgeSchema.parse(
          await request(getAccessToken, 'bridge-status', {
            txHash: result.txHash,
            fromChainId: input.fromChainId,
            toChainId: input.toChainId,
          }),
        );
        if (bridge.state === 'delivered') {
          return {
            ...result,
            bridgeState: 'delivered' as const,
            bridgeTxHash: bridge.destTxHash ?? null,
            bridgeExplorerUrl: bridge.explorerUrl ?? null,
            bridgeMessage: bridge.message ?? null,
          };
        }
        if (bridge.state === 'failed' || bridge.state === 'refunded') {
          return {
            ...result,
            bridgeState: bridge.state,
            bridgeTxHash: bridge.destTxHash ?? null,
            bridgeExplorerUrl: bridge.explorerUrl ?? null,
            bridgeMessage: bridge.message ?? null,
          };
        }
        await pause(3_000);
      }
      return { ...result, bridgeState: 'pending' as const };
    },

    async receive(chainId: number, token: string): Promise<MoneyReceiveInfo> {
      await ensureAccount(chainId);
      const result = receiveSchema.parse(
        await request(getAccessToken, 'receive', { chainId, token }),
      );
      return {
        address: result.address as MoneyReceiveInfo['address'],
        uri: result.uri ?? null,
      };
    },
  };
}
