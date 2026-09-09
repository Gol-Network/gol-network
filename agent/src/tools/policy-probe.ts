/**
 * Privy signer policy probe.
 *
 * Sends one allowed GOL call and one harmless wrong-destination request. The allowed call proves
 * the policy permits the exact envelope; the wrong-destination request must be denied by Privy
 * before it is broadcast.
 *
 * The allowed call consumes agent gas, so the probe requires an explicit environment opt-in.
 *
 * Run: pnpm --filter @gol/agent probe
 */
import { ARC_TESTNET_CHAIN_ID, addressSchema, golAccountAbi } from '@gol/protocol';
import { encodeFunctionData } from 'viem';
import { buildAgentSignerPolicy, evaluateAgentPolicy } from '../privy/policy.js';
import { PrivyScopedSigner } from '../privy/signer.js';
import { SignerPolicyError } from '../payment/types.js';

const OPT_IN = process.env.GOL_POLICY_PROBE;
if (OPT_IN !== '1') {
  process.stderr.write(
    'Set GOL_POLICY_PROBE=1 to run the probe. Its allowed call consumes agent gas.\n',
  );
  process.exit(2);
}

const appId = required('PRIVY_APP_ID');
const appSecret = required('PRIVY_APP_SECRET');
const authorizationPrivateKey = required('PRIVY_AUTHORIZATION_PRIVATE_KEY');
const walletId = required('GOL_PROBE_WALLET_ID');
const account = addressSchema.parse(required('GOL_PROBE_ACCOUNT'));
const mandateId = BigInt(process.env.GOL_PROBE_MANDATE_ID ?? '1');
// A deliberately unrelated destination. Nothing is transferred and nothing should be broadcast.
const wrongDestination = addressSchema.parse(
  process.env.GOL_PROBE_WRONG_DESTINATION ?? '0x000000000000000000000000000000000000dEaD',
);

void main();

async function main() {
  const policy = buildAgentSignerPolicy(account);
  const signer = new PrivyScopedSigner(walletId, {
    appId,
    appSecret,
    authorizationPrivateKey,
  });

  // A read-only account getter, submitted as a transaction so Privy actually evaluates the policy.
  const harmlessCall = encodeFunctionData({
    abi: golAccountAbi,
    functionName: 'remaining',
    args: [mandateId],
  });

  const localAllowed = evaluateAgentPolicy(policy, {
    method: 'eth_sendTransaction',
    chainId: ARC_TESTNET_CHAIN_ID,
    to: account,
    value: 0n,
  });
  const localDenied = evaluateAgentPolicy(policy, {
    method: 'eth_sendTransaction',
    chainId: ARC_TESTNET_CHAIN_ID,
    to: wrongDestination,
    value: 0n,
  });

  let allowedHash: string | null = null;
  let allowedError: string | null = null;
  try {
    const submission = await signer.sendTransaction({
      chainId: ARC_TESTNET_CHAIN_ID,
      to: account,
      value: 0n,
      data: harmlessCall,
      referenceId: `policy-probe-allow-${Date.now()}`,
    });
    allowedHash = submission.txHash;
  } catch (error) {
    allowedError = error instanceof SignerPolicyError ? 'SIGNER_BLOCKED' : 'REQUEST_FAILED';
  }

  let deniedBeforeBroadcast = false;
  let deniedHash: string | null = null;
  let deniedError: string | null = null;
  try {
    const submission = await signer.sendTransaction({
      chainId: ARC_TESTNET_CHAIN_ID,
      to: wrongDestination,
      value: 0n,
      data: '0x',
      referenceId: `policy-probe-deny-${Date.now()}`,
    });
    deniedHash = submission.txHash;
  } catch (error) {
    deniedBeforeBroadcast = error instanceof SignerPolicyError;
    deniedError = deniedBeforeBroadcast ? 'SIGNER_BLOCKED' : 'REQUEST_FAILED';
  }

  const accepted =
    localAllowed === 'ALLOW' &&
    localDenied === 'DENY' &&
    allowedHash !== null &&
    deniedBeforeBroadcast;
  process.stdout.write(
    `${JSON.stringify(
      {
        accepted,
        policyName: policy.name,
        chainId: ARC_TESTNET_CHAIN_ID,
        account,
        localEvaluation: { allowed: localAllowed, wrongDestination: localDenied },
        allowedCall: { broadcast: allowedHash !== null, txHash: allowedHash, error: allowedError },
        wrongDestinationCall: {
          deniedBeforeBroadcast,
          txHash: deniedHash,
          error: deniedError,
        },
      },
      null,
      2,
    )}\n`,
  );
  if (!accepted) process.exitCode = 1;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}
