import { hostname } from 'node:os';
import { addressSchema } from '@gol/protocol';
import { Pool } from 'pg';
import { PgJournal, type JournalRequest } from '../db/journal.js';
import { OpenAIJsonModel } from '../model/openai.js';
import { PrivyScopedSigner } from '../privy/signer.js';
import {
  AwsKmsSigner,
  createKmsClient,
  kmsSignerBackend,
  type AgentSigner,
} from '../signers/index.js';
import { ViemPaymentChain } from './viem-chain.js';
import {
  PaymentWorker,
  type KmsExecutionConfig,
  type WorkerContext,
  type WorkerContextResolver,
} from './worker.js';

const provider = (process.env.AGENT_SIGNER_PROVIDER ?? 'privy').trim();
if (provider !== 'privy' && provider !== 'aws_kms') {
  throw new Error('AGENT_SIGNER_PROVIDER must be privy or aws_kms');
}

const baseRequired = ['DATABASE_URL', 'ARC_RPC_URL'] as const;
for (const name of baseRequired) {
  if (!process.env[name]) throw new Error(`${name} is required`);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
const journal = new PgJournal(pool);
const rpcUrl = process.env.ARC_RPC_URL!;

// -------------------------------------------------------------------------------------------------
// AWS KMS signer: one client and one signer per worker process. The web process never builds these.
// -------------------------------------------------------------------------------------------------

let kmsSigner: AgentSigner | null = null;
let kmsConfig: KmsExecutionConfig | null = null;

if (provider === 'aws_kms') {
  const kmsRequired = [
    'AWS_KMS_SIGNER_KEY_ARN',
    'AWS_KMS_SIGNER_REGION',
    'AWS_KMS_SIGNER_ADDRESS',
    'AGENT_MAX_GAS',
    'AGENT_MAX_FEE_PER_GAS',
  ] as const;
  for (const name of kmsRequired) {
    // Names only: the key ARN is operational configuration.
    if (!process.env[name])
      throw new Error(`${name} is required for AGENT_SIGNER_PROVIDER=aws_kms`);
  }
  const keyArn = process.env.AWS_KMS_SIGNER_KEY_ARN!;
  const region = process.env.AWS_KMS_SIGNER_REGION!;
  const expectedAddress = addressSchema.parse(process.env.AWS_KMS_SIGNER_ADDRESS!.trim());

  kmsSigner = new AwsKmsSigner({
    keyArn,
    region,
    expectedAddress,
    backend: kmsSignerBackend(createKmsClient(region)),
  });
  kmsConfig = {
    keyArn,
    maxGas: BigInt(process.env.AGENT_MAX_GAS!),
    maxFeePerGas: BigInt(process.env.AGENT_MAX_FEE_PER_GAS!),
    maxPriorityFeePerGas: BigInt(
      process.env.AGENT_MAX_PRIORITY_FEE_PER_GAS ?? process.env.AGENT_MAX_FEE_PER_GAS!,
    ),
    gasMargin: Number(process.env.AGENT_GAS_MARGIN ?? '1.25'),
    gasLowWatermark: BigInt(process.env.AGENT_GAS_LOW_WATERMARK ?? '0'),
  };

  // Fail closed on startup: the derived address must match configuration and every linked row.
  const linked = await pool.query(
    `SELECT agent_address, signer_address FROM account_links WHERE signer_provider = 'aws_kms'`,
  );
  const linkedAddresses = linked.rows.flatMap((row: Record<string, unknown>) =>
    [row.agent_address, row.signer_address]
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
      .map((value) => value.trim()),
  );
  const derived = await (kmsSigner as AwsKmsSigner).verify(linkedAddresses);
  process.stdout.write(
    `${JSON.stringify({ event: 'kms_signer_ready', provider, address: derived, region })}\n`,
  );
}

// -------------------------------------------------------------------------------------------------

const resolver: WorkerContextResolver = {
  async resolve(job: JournalRequest): Promise<WorkerContext> {
    const result = await pool.query(
      `SELECT a.user_subject, a.account_address, a.agent_wallet_id, a.agent_address,
              a.signer_provider, a.signer_key_arn, a.signer_region, a.signer_address,
              r.address AS recipient_address, r.label
       FROM account_links a
       LEFT JOIN recipients r USING (account_address)
       WHERE a.user_subject = $1 AND lower(a.account_address) = lower($2)`,
      [job.userSubject, job.account],
    );
    if (result.rowCount === 0) throw new Error('Verified agent context not found');
    const link = result.rows[0];
    const linkProvider = String(link.signer_provider ?? 'privy');
    const agentAddress = addressSchema.parse(
      String(link.signer_address ?? link.agent_address).trim(),
    );

    const base = {
      context: {
        userSubject: String(link.user_subject),
        chainId: 5_042_002 as const,
        account: addressSchema.parse(String(link.account_address).trim()),
        agentAddress,
        agentWalletId: link.agent_wallet_id ? String(link.agent_wallet_id) : 'aws_kms',
      },
      recipients: result.rows
        .filter((row: Record<string, unknown>) => row.recipient_address)
        .map((row: Record<string, unknown>) => ({
          address: addressSchema.parse(String(row.recipient_address).trim()),
          label: String(row.label),
        })),
      chain: new ViemPaymentChain(rpcUrl),
      ...(process.env.OPENAI_API_KEY
        ? { model: new OpenAIJsonModel({ apiKey: process.env.OPENAI_API_KEY }) }
        : {}),
    };

    if (linkProvider === 'aws_kms') {
      if (!kmsSigner || !kmsConfig) {
        throw new Error('Account link requires aws_kms but the worker is not configured for it');
      }
      return { ...base, mode: 'aws_kms', signer: kmsSigner, kms: kmsConfig };
    }

    for (const name of [
      'PRIVY_APP_ID',
      'PRIVY_APP_SECRET',
      'PRIVY_AUTHORIZATION_KEY_ID',
      'PRIVY_AUTHORIZATION_PRIVATE_KEY',
    ]) {
      if (!process.env[name]) throw new Error(`${name} is required for a privy account link`);
    }
    return {
      ...base,
      mode: 'privy',
      signer: new PrivyScopedSigner(String(link.agent_wallet_id), {
        appId: process.env.PRIVY_APP_ID!,
        appSecret: process.env.PRIVY_APP_SECRET!,
        authorizationPrivateKey: process.env.PRIVY_AUTHORIZATION_PRIVATE_KEY!,
      }),
    };
  },
};

const worker = new PaymentWorker(`${hostname()}:${process.pid}`, journal, resolver);
let stopping = false;
process.once('SIGTERM', () => {
  stopping = true;
});
process.once('SIGINT', () => {
  stopping = true;
});

while (!stopping) {
  const worked = await worker.tick().catch((error: unknown) => {
    process.stderr.write(
      `worker tick failed: ${error instanceof Error ? error.message : 'unknown'}\n`,
    );
    return false;
  });
  if (!worked && !stopping) await new Promise((resolve) => setTimeout(resolve, 2_000));
}
await journal.close();
