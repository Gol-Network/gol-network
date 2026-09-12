import { createHash } from 'node:crypto';
import { PrivyClient } from '@privy-io/node';
import {
  ARC_TESTNET_CHAIN_ID,
  addressSchema,
  golAccountAbi,
  golAccountFactoryAbi,
} from '@gol/protocol';
import {
  AGENT_POLICY_REVISION,
  agentPolicyDisclosure,
  buildAgentSignerPolicy,
} from '@gol/agent/privy';
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

const recipientSchema = z.object({
  address: addressSchema,
  label: z.string().trim().min(1).max(100),
});

const schema = z
  .object({
    account: addressSchema,
    ownerAddress: addressSchema,
    recipientMode: z.enum(['all', 'allowlist']).default('allowlist'),
    recipients: z.array(recipientSchema).max(20).optional(),
    // Retained temporarily so an older open browser tab can still complete setup.
    recipient: addressSchema.optional(),
    recipientLabel: z.string().trim().min(1).max(100).optional(),
    consent: z.literal(true),
  })
  .superRefine((value, context) => {
    const recipients = selectedRecipients(value);
    if (value.recipientMode === 'allowlist' && recipients.length === 0) {
      context.addIssue({
        code: 'custom',
        message: 'A named recipient address is required for allowlist mode.',
      });
    }
    const addresses = recipients.map((recipient) => recipient.address.toLowerCase());
    const labels = recipients.map((recipient) => recipient.label.toLowerCase());
    if (new Set(addresses).size !== addresses.length || new Set(labels).size !== labels.length) {
      context.addIssue({
        code: 'custom',
        message: 'Recipient addresses and names must be unique.',
      });
    }
  });

function selectedRecipients(body: {
  recipients?: Array<{ address: `0x${string}`; label: string }> | undefined;
  recipient?: `0x${string}` | undefined;
  recipientLabel?: string | undefined;
}) {
  if (body.recipients) return body.recipients;
  return body.recipient && body.recipientLabel
    ? [{ address: body.recipient, label: body.recipientLabel }]
    : [];
}

export async function POST(request: Request) {
  try {
    const session = await authenticate(request);
    requireWriteOrigin(request, session);
    rateLimit(`setup:${session.subject}`, 2);
    const body = schema.parse(await readJson(request));
    const existing = await pool.query(
      `SELECT * FROM account_links
       WHERE user_subject = $1
          OR lower(owner_address) = lower($2)
          OR lower(account_address) = lower($3)`,
      [session.subject, body.ownerAddress, body.account],
    );
    if ((existing.rowCount ?? 0) > 1) throw new HttpError(409, 'ACCOUNT_LINK_CONFLICT');
    let existingRow = existing.rowCount === 1 ? existing.rows[0] : null;

    const { server, public: publicConfig } = runtimeConfig();
    const appId = server.privyAppId;
    const appSecret = server.privyAppSecret;
    if (!appId || !appSecret || session.developer) {
      throw new HttpError(503, 'AGENT_PROVISIONING_UNAVAILABLE');
    }

    if (!publicConfig.factoryAddress) throw new HttpError(503, 'FACTORY_NOT_CONFIGURED');
    const client = arcClient();
    const [chainOwner, factoryAccount] = await Promise.all([
      client.readContract({
        address: body.account,
        abi: golAccountAbi,
        functionName: 'owner',
      }),
      client.readContract({
        address: publicConfig.factoryAddress,
        abi: golAccountFactoryAbi,
        functionName: 'accounts',
        args: [body.ownerAddress],
      }),
    ]);
    if (chainOwner.toLowerCase() !== body.ownerAddress.toLowerCase()) {
      throw new HttpError(403, 'OWNER_MISMATCH');
    }
    if (factoryAccount.toLowerCase() !== body.account.toLowerCase()) {
      throw new HttpError(403, 'FACTORY_ACCOUNT_MISMATCH');
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

    // The wallet signature is the authority boundary. Privy may rotate the subject when the same
    // owner signs in through a different linked login method, so preserve the account and journal
    // while moving their subject together instead of inserting a duplicate owner/account row.
    if (existingRow && String(existingRow.user_subject) !== session.subject) {
      existingRow = (
        await pool.query(
          `UPDATE account_links
           SET user_subject = $1, updated_at = now()
           WHERE user_subject = $2
           RETURNING *`,
          [session.subject, String(existingRow.user_subject)],
        )
      ).rows[0];
    }

    const accountChanged = Boolean(
      existingRow &&
      String(existingRow.account_address).trim().toLowerCase() !== body.account.toLowerCase(),
    );

    const existingProvider = String(existingRow?.signer_provider ?? 'privy');
    if (
      existingRow &&
      (existingProvider === 'aws_kms' ||
        (!accountChanged && String(existingRow.policy_version ?? '') === AGENT_POLICY_REVISION))
    ) {
      const activeRow = accountChanged
        ? (
            await pool.query(
              `UPDATE account_links
               SET owner_address = $2, account_address = $3, updated_at = now()
               WHERE user_subject = $1
               RETURNING *`,
              [session.subject, body.ownerAddress, body.account],
            )
          ).rows[0]
        : existingRow;
      await saveRecipientChoice(body);
      return Response.json(agentResponse(activeRow));
    }

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
      await saveRecipientChoice(body);
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
        idempotency_key: `gol-policy-v${AGENT_POLICY_REVISION}-${stableKey}`,
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
        idempotency_key: `gol-wallet-v${AGENT_POLICY_REVISION}-${stableKey}`,
      });
    } catch {
      throw new HttpError(502, 'PRIVY_WALLET_CREATION_FAILED');
    }
    const inserted = existingRow
      ? await pool.query(
          `UPDATE account_links
           SET owner_address = $2, account_address = $3, agent_wallet_id = $4,
               agent_address = $5, policy_id = $6, policy_version = $7,
               signer_provider = 'privy', updated_at = now()
           WHERE user_subject = $1
           RETURNING *`,
          [
            session.subject,
            body.ownerAddress,
            body.account,
            wallet.id,
            wallet.address,
            policy.id,
            AGENT_POLICY_REVISION,
          ],
        )
      : await pool.query(
          `INSERT INTO account_links
            (user_subject, owner_address, account_address, agent_wallet_id, agent_address, policy_id,
             policy_version, signer_provider)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'privy')
           RETURNING *`,
          [
            session.subject,
            body.ownerAddress,
            body.account,
            wallet.id,
            wallet.address,
            policy.id,
            AGENT_POLICY_REVISION,
          ],
        );
    await saveRecipientChoice(body);
    return Response.json(agentResponse(inserted.rows[0]), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

async function saveRecipientChoice(body: z.infer<typeof schema>) {
  const recipients = selectedRecipients(body);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE account_links
       SET recipient_mode = $2, updated_at = now()
       WHERE lower(account_address) = lower($1)`,
      [body.account, body.recipientMode],
    );
    if (body.recipientMode === 'allowlist') {
      await client.query('DELETE FROM recipients WHERE lower(account_address) = lower($1)', [
        body.account,
      ]);
      for (const recipient of recipients) {
        await client.query(
          `INSERT INTO recipients (account_address, address, label, confirmed_at)
           VALUES ($1, $2, $3, now())`,
          [body.account, recipient.address, recipient.label],
        );
      }
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
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
    policyVersion: row.policy_version ? String(row.policy_version) : null,
    chainId: ARC_TESTNET_CHAIN_ID,
    policy: agentPolicyDisclosure(account),
  };
}
