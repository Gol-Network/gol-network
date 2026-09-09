import { ARC_TESTNET_USDC, erc20Abi, golAccountAbi } from '@gol/protocol';
import { agentPolicyDisclosure } from '@gol/agent/privy';
import { NextResponse } from 'next/server';
import { authenticate, errorResponse, pool } from '@/server/core';
import { arcClient } from '@/server/chain';
import { runtimeConfig } from '@/server/env';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const session = await authenticate(request);
    const { public: publicConfig } = runtimeConfig();
    const result = await pool.query(
      `SELECT owner_address, account_address, agent_address, agent_wallet_id, policy_id, updated_at
       FROM account_links WHERE user_subject = $1`,
      [session.subject],
    );
    if (result.rowCount !== 1) {
      return NextResponse.json({ state: 'no_account', chainId: publicConfig.chainId });
    }
    const row = result.rows[0];
    const client = arcClient();
    const accountAddress = String(row.account_address).trim() as `0x${string}`;
    const ownerAddress = String(row.owner_address).trim() as `0x${string}`;
    const agentAddress = String(row.agent_address).trim() as `0x${string}`;

    const [chainOwner, accountUsdc, activeMandateId, ownerGas, agentGas, recipients] =
      await Promise.all([
        client.readContract({ address: accountAddress, abi: golAccountAbi, functionName: 'owner' }),
        client.readContract({
          address: ARC_TESTNET_USDC,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [accountAddress],
        }),
        client.readContract({
          address: accountAddress,
          abi: golAccountAbi,
          functionName: 'activeMandateId',
        }),
        client.getBalance({ address: ownerAddress }),
        client.getBalance({ address: agentAddress }),
        pool.query(
          'SELECT address, label FROM recipients WHERE lower(account_address) = lower($1) ORDER BY label',
          [accountAddress],
        ),
      ]);

    if (chainOwner.toLowerCase() !== ownerAddress.toLowerCase()) {
      return NextResponse.json({ error: 'ONCHAIN_OWNER_MISMATCH' }, { status: 409 });
    }
    const mandate =
      activeMandateId === 0n
        ? null
        : await client.readContract({
            address: accountAddress,
            abi: golAccountAbi,
            functionName: 'getMandate',
            args: [activeMandateId],
          });

    return NextResponse.json({
      state: 'ready',
      chainId: publicConfig.chainId,
      ownerAddress,
      accountAddress,
      agentAddress,
      agentControl: {
        walletId: row.agent_wallet_id,
        policyId: row.policy_id,
        status: 'configured',
        disclosure: agentPolicyDisclosure(accountAddress),
      },
      // The native gas view and the ERC-20 payment view describe the same underlying Arc USDC.
      // They are reported separately and must never be added together.
      balances: {
        accountUsdcUnits: accountUsdc.toString(),
        ownerGasWei: ownerGas.toString(),
        agentGasWei: agentGas.toString(),
      },
      recipients: recipients.rows.map((recipient: Record<string, unknown>) => ({
        address: String(recipient.address).trim(),
        label: String(recipient.label),
      })),
      balanceUnits: accountUsdc.toString(),
      activeMandateId: activeMandateId.toString(),
      mandate: mandate
        ? {
            agent: mandate.agent,
            perPaymentCapUnits: mandate.perPaymentCap.toString(),
            cumulativeCapUnits: mandate.cumulativeCap.toString(),
            spentUnits: mandate.spent.toString(),
            expiresAt: mandate.expiresAt.toString(),
            revoked: mandate.revoked,
          }
        : null,
      chainReadAt: new Date().toISOString(),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
