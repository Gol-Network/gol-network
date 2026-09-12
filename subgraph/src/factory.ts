import { AccountCreated } from '../generated/GolAccountFactory/GolAccountFactory';
import { GolAccount as GolAccountTemplate } from '../generated/templates';
import { Account, LifecycleEvent } from '../generated/schema';

export function handleAccountCreated(event: AccountCreated): void {
  const account = new Account(event.params.account);
  account.owner = event.params.owner;
  account.createdAtBlock = event.block.number;
  account.createdAt = event.block.timestamp;
  account.save();

  const lifecycle = new LifecycleEvent(event.transaction.hash.concatI32(event.logIndex.toI32()));
  lifecycle.account = event.params.account;
  lifecycle.kind = 'ACCOUNT_CREATED';
  lifecycle.transactionHash = event.transaction.hash;
  lifecycle.blockNumber = event.block.number;
  lifecycle.blockHash = event.block.hash;
  lifecycle.timestamp = event.block.timestamp;
  lifecycle.logIndex = event.logIndex;
  lifecycle.save();
  GolAccountTemplate.create(event.params.account);
}
