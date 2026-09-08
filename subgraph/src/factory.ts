import { AccountCreated } from '../generated/GolAccountFactory/GolAccountFactory';
import { GolAccount as GolAccountTemplate } from '../generated/templates';
import { Account } from '../generated/schema';

export function handleAccountCreated(event: AccountCreated): void {
  const account = new Account(event.params.account);
  account.owner = event.params.owner;
  account.createdAtBlock = event.block.number;
  account.createdAt = event.block.timestamp;
  account.save();
  GolAccountTemplate.create(event.params.account);
}
