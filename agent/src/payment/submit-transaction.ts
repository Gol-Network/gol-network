import {
  ARC_TESTNET_CHAIN_ID,
  golAccountAbi,
  parseUsdc,
  type Hex32,
  type PaymentIntent,
  type VerifiedAgentContext,
} from '@gol/protocol';
import { encodeFunctionData } from 'viem';
import { PaymentIntegrityError, type TransactionRequest } from './types.js';

export function createPaymentTransaction(
  context: VerifiedAgentContext,
  requestId: Hex32,
  mandateId: string,
  intent: PaymentIntent,
): TransactionRequest {
  if (context.chainId !== ARC_TESTNET_CHAIN_ID) throw new PaymentIntegrityError('Wrong chain');
  return {
    chainId: ARC_TESTNET_CHAIN_ID,
    to: context.account,
    value: 0n,
    data: encodeFunctionData({
      abi: golAccountAbi,
      functionName: 'pay',
      args: [BigInt(mandateId), requestId, intent.recipient, parseUsdc(intent.amountUsdc)],
    }),
    referenceId: requestId.slice(2),
  };
}
