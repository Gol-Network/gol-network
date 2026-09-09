import { createHash } from 'node:crypto';
import { PrivyClient } from '@privy-io/node';
import { ARC_TESTNET_CHAIN_ID, addressSchema, golAccountAbi } from '@gol/protocol';
import { agentPolicyDisclosure, buildAgentSignerPolicy } from '@gol/agent/privy';
import { kmsAgentDisclosure } from '@gol/agent/signer-disclosure';
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
    if (!appId || !appSecret || session.developer) {
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

    // The authenticated Privy user must actually control the owner wallet being linked.
    const privy = new PrivyClient({ appId, appSecret });
    const user = await privy.users()._get(session.subject);
    const ownsWallet = user.linked_accounts.some(
      (account) =>
        'address' in account &&
        typeof account.address === 'string' &&
        account.address.toLowerCase() === body.ownerAddress.toLowerCase(),
    );
    if (!ownsWallet) throw new HttpError(403, 'PRIVY_WALLET_MISMATCH');

    if (server.agentSignerProvider === 'aws_kms') {
      const keyArn = server.awsKmsSignerKeyArn;
      const region = server.awsKmsSignerRegion;
      const signerAddress = server.awsKmsSignerAddress;
      if (!keyArn || !region || !signerAddress) {
        throw new HttpError(503, 'AGENT_SIGNER_UNAVAILABLE');
      }
      // No Privy agent wallet or policy is created. The worker derives and verifies this address
      // from the exact KMS key on startup and refuses to run on any mismatch.
      const inserted = await pool.query(
        `INSERT INTO account_links
          (user_subject, owner_address, account_address, agent_address,
           signer_provider, signer_key_arn, signer_region, signer_address)
         VALUES ($1, $2, $3, $4, 'aws_kms', $5, $6, $4)
         RETURNING *`,
        [session.subject, body.ownerAddress, body.account, signerAddress, keyArn, region],
      );
      await pool.query(
        `INSERT INTO recipients (account_address, address, label) VALUES ($1, $2, $3)
         ON CONFLICT (account_address, address) DO UPDATE SET label = EXCLUDED.label`,
        [body.account, body.recipient, body.recipientLabel],
      );
      return Response.json(agentResponse(inserted.rows[0]), { status: 201 });
    }

    // Privy provider: retained agent-wallet and scoped-policy provisioning.
    const signerId = server.privyAuthorizationKeyId;
    if (!signerId) throw new HttpError(503, 'AGENT_PROVISIONING_UNAVAILABLE');
    const stableKey = createHash('sha256')
      .update(`${session.subject}:${body.account.toLowerCase()}`)
      .digest('hex');
    let policy;
    try {
      policy = await privy.policies().create({
        ...buildAgentSignerPolicy(body.account),
        owner: { user_id: session.subject },
        idempotency_key: `gol-policy-${stableKey}`,
      });
    } catch {
      throw new HttpError(502, 'PRIVY_POLICY_CREATION_FAILED');
    }
    let wallet;
    try {
      wallet = await privy.wallets().create({
        chain_type: 'ethereum',
        display_name: 'GOL restricted agent',
        owner: { user_id: session.subject },
        additional_signers: [{ signer_id: signerId, override_policy_ids: [policy.id] }],
        idempotency_key: `gol-wallet-${stableKey}`,
      });
    } catch {
      throw new HttpError(502, 'PRIVY_WALLET_CREATION_FAILED');
    }
    const inserted = await pool.query(
      `INSERT INTO account_links
        (user_subject, owner_address, account_address, agent_wallet_id, agent_address, policy_id,
         signer_provider)
       VALUES ($1, $2, $3, $4, $5, $6, 'privy')
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
  const agentAddress = String(row.agent_address).trim();
  if (String(row.signer_provider ?? 'privy') === 'aws_kms') {
    return {
      account,
      agentAddress,
      provider: 'aws_kms' as const,
      walletId: null,
      policyId: null,
      chainId: ARC_TESTNET_CHAIN_ID,
      signer: kmsAgentDisclosure(addressSchema.parse(agentAddress)),
    };
  }
  return {
    account,
    agentAddress,
    provider: 'privy' as const,
    walletId: row.agent_wallet_id ? String(row.agent_wallet_id) : null,
    policyId: row.policy_id ? String(row.policy_id) : null,
    chainId: ARC_TESTNET_CHAIN_ID,
    policy: agentPolicyDisclosure(account),
  };
}
