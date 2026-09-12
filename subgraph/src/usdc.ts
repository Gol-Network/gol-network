import { Account, LifecycleEvent } from '../generated/schema';
import { Transfer } from '../generated/ArcUsdc/ArcUsdc';

export function handleTransfer(event: Transfer): void {
  const account = Account.load(event.params.to);
  if (account === null) return;

  const lifecycle = new LifecycleEvent(event.transaction.hash.concatI32(event.logIndex.toI32()));
  lifecycle.account = event.params.to;
  lifecycle.kind = 'FUNDS_ADDED';
  lifecycle.amount = event.params.value;
  lifecycle.transactionHash = event.transaction.hash;
  lifecycle.blockNumber = event.block.number;
  lifecycle.blockHash = event.block.hash;
  lifecycle.timestamp = event.block.timestamp;
  lifecycle.logIndex = event.logIndex;
  lifecycle.save();
}
