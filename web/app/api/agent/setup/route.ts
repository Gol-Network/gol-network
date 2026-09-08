import { createHash } from 'node:crypto';
import { PrivyClient } from '@privy-io/node';
import { ARC_TESTNET_CHAIN_ID, addressSchema, golAccountAbi } from '@gol/protocol';
import { createPublicClient, defineChain, http } from 'viem';
import { z } from 'zod';
import {
  authenticate,
  errorResponse,
  HttpError,
  pool,
  rateLimit,
  readJson,
  requireWriteOrigin,
} from '@/server/core';

export const runtime = 'nodejs';

const schema = z.object({
  account: addressSchema,
  ownerAddress: addressSchema,
  recipient: addressSchema,
  recipientLabel: z.string().trim().min(1).max(100),
  consent: z.literal(true),
});

export async function POST(request: Request) {
  try {
    const session = await authenticate(request);
    requireWriteOrigin(request, session);
    rateLimit(`setup:${session.subject}`, 2);
    const body = schema.parse(await readJson(request));
    const existing = await pool.query('SELECT * FROM account_links WHERE user_subject = $1', [
      session.subject,
    ]);
    if (existing.rowCount === 1) {
      const row = existing.rows[0];
      if (String(row.account_address).trim().toLowerCase() !== body.account.toLowerCase()) {
        throw new HttpError(409, 'ACCOUNT_ALREADY_LINKED');
      }
      return Response.json(agentResponse(row));
    }

    const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
    const appSecret = process.env.PRIVY_APP_SECRET;
    const signerId = process.env.PRIVY_AUTHORIZATION_KEY_ID;
    const rpcUrl = process.env.ARC_RPC_URL;
    if (!appId || !appSecret || !signerId || !rpcUrl || session.developer) {
      throw new HttpError(503, 'AGENT_PROVISIONING_UNAVAILABLE');
    }
    const chain = defineChain({
      id: ARC_TESTNET_CHAIN_ID,
      name: 'Arc Testnet',
      nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
      rpcUrls: { default: { http: [rpcUrl] } },
      testnet: true,
    });
    const chainOwner = await createPublicClient({ chain, transport: http(rpcUrl) }).readContract({
      address: body.account,
      abi: golAccountAbi,
      functionName: 'owner',
    });
    if (chainOwner.toLowerCase() !== body.ownerAddress.toLowerCase()) {
      throw new HttpError(403, 'OWNER_MISMATCH');
    }

    const privy = new PrivyClient({ appId, appSecret });
    const user = await privy.users()._get(session.subject);
    const ownsWallet = user.linked_accounts.some(
      (account) =>
        'address' in account &&
        typeof account.address === 'string' &&
        account.address.toLowerCase() === body.ownerAddress.toLowerCase(),
    );
    if (!ownsWallet) throw new HttpError(403, 'PRIVY_WALLET_MISMATCH');

    const stableKey = createHash('sha256')
      .update(`${session.subject}:${body.account.toLowerCase()}`)
      .digest('hex');
    const policy = await privy.policies().create({
      chain_type: 'ethereum',
      name: `GOL ${body.account.slice(0, 10)} agent`,
      version: '1.0',
      owner: { user_id: session.subject },
      rules: [
        {
          name: 'Only submit to this GOL account on Arc',
          action: 'ALLOW',
          method: 'eth_sendTransaction',
          conditions: [
            {
              field_source: 'ethereum_transaction',
              field: 'chain_id',
              operator: 'eq',
              value: String(ARC_TESTNET_CHAIN_ID),
            },
            {
              field_source: 'ethereum_transaction',
              field: 'to',
              operator: 'eq',
              value: body.account,
            },
            { field_source: 'ethereum_transaction', field: 'value', operator: 'eq', value: '0' },
          ],
        },
      ],
      idempotency_key: `gol-policy-${stableKey}`,
    });
    const wallet = await privy.wallets().create({
      chain_type: 'ethereum',
      display_name: 'GOL restricted agent',
      owner: { user_id: session.subject },
      additional_signers: [{ signer_id: signerId, override_policy_ids: [policy.id] }],
      idempotency_key: `gol-wallet-${stableKey}`,
    });
    const inserted = await pool.query(
      `INSERT INTO account_links
        (user_subject, owner_address, account_address, agent_wallet_id, agent_address, policy_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [session.subject, body.ownerAddress, body.account, wallet.id, wallet.address, policy.id],
    );
    await pool.query(
      `INSERT INTO recipients (account_address, address, label) VALUES ($1, $2, $3)
       ON CONFLICT (account_address, address) DO UPDATE SET label = EXCLUDED.label`,
      [body.account, body.recipient, body.recipientLabel],
    );
    return Response.json(agentResponse(inserted.rows[0]), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

function agentResponse(row: Record<string, unknown>) {
  return {
    account: String(row.account_address).trim(),
    agentAddress: String(row.agent_address).trim(),
    walletId: String(row.agent_wallet_id),
    policyId: String(row.policy_id),
    policy: {
      chainId: ARC_TESTNET_CHAIN_ID,
      to: String(row.account_address).trim(),
      value: '0',
      defaultAction: 'DENY',
    },
  };
}
