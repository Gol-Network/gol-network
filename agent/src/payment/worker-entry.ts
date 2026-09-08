import { hostname } from 'node:os';
import { addressSchema } from '@gol/protocol';
import { Pool } from 'pg';
import { PgJournal, type JournalRequest } from '../db/journal.js';
import { OpenAIJsonModel } from '../model/openai.js';
import { PrivyScopedSigner } from '../privy/signer.js';
import { ViemPaymentChain } from './viem-chain.js';
import { PaymentWorker, type WorkerContext, type WorkerContextResolver } from './worker.js';

const required = [
  'DATABASE_URL',
  'ARC_RPC_URL',
  'PRIVY_APP_ID',
  'PRIVY_APP_SECRET',
  'PRIVY_AUTHORIZATION_PRIVATE_KEY',
] as const;
for (const name of required) {
  if (!process.env[name]) throw new Error(`${name} is required`);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
const journal = new PgJournal(pool);

const resolver: WorkerContextResolver = {
  async resolve(job: JournalRequest): Promise<WorkerContext> {
    const result = await pool.query(
      `SELECT a.user_subject, a.account_address, a.agent_wallet_id, a.agent_address,
              r.address AS recipient_address, r.label
       FROM account_links a
       LEFT JOIN recipients r USING (account_address)
       WHERE a.user_subject = $1 AND lower(a.account_address) = lower($2)`,
      [job.userSubject, job.account],
    );
    if (result.rowCount === 0) throw new Error('Verified agent context not found');
    const link = result.rows[0];
    return {
      context: {
        userSubject: String(link.user_subject),
        chainId: 5_042_002,
        account: addressSchema.parse(String(link.account_address).trim()),
        agentAddress: addressSchema.parse(String(link.agent_address).trim()),
        agentWalletId: String(link.agent_wallet_id),
      },
      recipients: result.rows
        .filter((row) => row.recipient_address)
        .map((row) => ({
          address: addressSchema.parse(String(row.recipient_address).trim()),
          label: String(row.label),
        })),
      signer: new PrivyScopedSigner(String(link.agent_wallet_id), {
        appId: process.env.PRIVY_APP_ID!,
        appSecret: process.env.PRIVY_APP_SECRET!,
        authorizationPrivateKey: process.env.PRIVY_AUTHORIZATION_PRIVATE_KEY!,
      }),
      chain: new ViemPaymentChain(process.env.ARC_RPC_URL!),
      ...(process.env.OPENAI_API_KEY
        ? { model: new OpenAIJsonModel({ apiKey: process.env.OPENAI_API_KEY }) }
        : {}),
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
