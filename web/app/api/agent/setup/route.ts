import { createHash } from 'node:crypto';
import { PrivyClient } from '@privy-io/node';
import { ARC_TESTNET_CHAIN_ID, addressSchema, golAccountAbi } from '@gol/protocol';
import { agentPolicyDisclosure, buildAgentSignerPolicy } from '@gol/agent/privy';
import { z } from 'zod';
import { arcClient } from '@/server/chain';
import { runtimeConfig } from '@/server/env';
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

    const { server } = runtimeConfig();
    const appId = server.privyAppId;
    const appSecret = server.privyAppSecret;
    // PRIVY_AUTHORIZATION_KEY_ID is the key-quorum/signer ID that owns
    // PRIVY_AUTHORIZATION_PRIVATE_KEY. Startup validation proves they are configured as a pair.
    const signerId = server.privyAuthorizationKeyId;
    if (!appId || !appSecret || !signerId || session.developer) {
      throw new HttpError(503, 'AGENT_PROVISIONING_UNAVAILABLE');
    }
    const chainOwner = await arcClient().readContract({
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
      ...buildAgentSignerPolicy(body.account),
      owner: { user_id: session.subject },
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
  const account = addressSchema.parse(String(row.account_address).trim());
  return {
    account,
    agentAddress: String(row.agent_address).trim(),
    walletId: String(row.agent_wallet_id),
    policyId: String(row.policy_id),
    chainId: ARC_TESTNET_CHAIN_ID,
    policy: agentPolicyDisclosure(account),
  };
}
