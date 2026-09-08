import { ARC_TESTNET_CHAIN_ID, ARC_TESTNET_USDC, erc20Abi, golAccountAbi } from '@gol/protocol';
import { NextResponse } from 'next/server';
import { createPublicClient, defineChain, http } from 'viem';
import { authenticate, errorResponse, pool } from '@/server/core';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const session = await authenticate(request);
    const result = await pool.query(
      `SELECT owner_address, account_address, agent_address, agent_wallet_id, policy_id, updated_at
       FROM account_links WHERE user_subject = $1`,
      [session.subject],
    );
    if (result.rowCount !== 1) return NextResponse.json({ state: 'no_account' });
    const row = result.rows[0];
    const rpcUrl = process.env.ARC_RPC_URL;
    if (!rpcUrl) return NextResponse.json({ error: 'RPC_UNAVAILABLE' }, { status: 503 });
    const chain = defineChain({
      id: ARC_TESTNET_CHAIN_ID,
      name: 'Arc Testnet',
      nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
      rpcUrls: { default: { http: [rpcUrl] } },
      testnet: true,
    });
    const client = createPublicClient({ chain, transport: http(rpcUrl) });
    const accountAddress = String(row.account_address).trim() as `0x${string}`;
    const [chainOwner, balance, activeMandateId] = await Promise.all([
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
    ]);
    if (chainOwner.toLowerCase() !== String(row.owner_address).trim().toLowerCase()) {
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
      chainId: ARC_TESTNET_CHAIN_ID,
      ownerAddress: String(row.owner_address).trim(),
      accountAddress,
      agentAddress: String(row.agent_address).trim(),
      agentControl: {
        walletId: row.agent_wallet_id,
        policyId: row.policy_id,
        status: 'configured',
      },
      balanceUnits: balance.toString(),
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
