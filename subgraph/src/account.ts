import { Address, BigInt, Bytes, ethereum } from '@graphprotocol/graph-ts';
import {
  Executed,
  MandateCreated,
  MandateRevoked,
  Refused,
} from '../generated/templates/GolAccount/GolAccount';
import { Action, Mandate } from '../generated/schema';

function mandateEntityId(account: Address, mandateId: BigInt): string {
  return account.toHexString().toLowerCase() + ':' + mandateId.toString();
}

function actionId(transactionHash: Bytes, logIndex: BigInt): Bytes {
  return transactionHash.concatI32(logIndex.toI32());
}

export function handleMandateCreated(event: MandateCreated): void {
  const id = mandateEntityId(event.address, event.params.mandateId);
  const mandate = new Mandate(id);
  mandate.account = event.address;
  mandate.mandateId = event.params.mandateId;
  mandate.agent = event.params.agent;
  mandate.perPaymentCap = event.params.perPaymentCap;
  mandate.cumulativeCap = event.params.cumulativeCap;
  mandate.spent = BigInt.zero();
  mandate.expiresAt = event.params.expiresAt;
  const recipients = new Array<Bytes>(event.params.recipients.length);
  for (let i = 0; i < event.params.recipients.length; i++) {
    recipients[i] = event.params.recipients[i];
  }
  mandate.recipients = recipients;
  mandate.revoked = false;
  mandate.save();
}

export function handleMandateRevoked(event: MandateRevoked): void {
  const mandate = Mandate.load(mandateEntityId(event.address, event.params.mandateId));
  if (mandate !== null) {
    mandate.revoked = true;
    mandate.save();
  }
}

function setChainFields(action: Action, event: ethereum.Event): void {
  action.transactionHash = event.transaction.hash;
  action.blockNumber = event.block.number;
  action.blockHash = event.block.hash;
  action.timestamp = event.block.timestamp;
  action.logIndex = event.logIndex;
}

export function handleExecuted(event: Executed): void {
  const id = actionId(event.transaction.hash, event.logIndex);
  if (Action.load(id) !== null) return;
  const mandateId = mandateEntityId(event.address, event.params.mandateId);
  const action = new Action(id);
  action.account = event.address;
  action.mandate = mandateId;
  action.requestId = event.params.requestId;
  action.agent = event.params.agent;
  action.recipient = event.params.recipient;
  action.outcome = 'EXECUTED';
  action.rule = 'NONE';
  action.reason = 'Payment executed';
  action.attempted = event.params.amount;
  action.transferred = event.params.amount;
  action.headroom = event.params.headroom;
  action.spentAfter = event.params.spentAfter;
  action.sequence = event.params.sequence;
  setChainFields(action, event);
  action.save();

  const mandate = Mandate.load(mandateId);
  if (mandate !== null) {
    mandate.spent = event.params.spentAfter;
    mandate.save();
  }
}

function ruleName(rule: i32): string {
  if (rule === 1) return 'MANDATE_REVOKED';
  if (rule === 2) return 'MANDATE_EXPIRED';
  if (rule === 3) return 'RECIPIENT_NOT_ALLOWED';
  if (rule === 4) return 'PER_PAYMENT_CAP';
  if (rule === 5) return 'CUMULATIVE_CAP';
  return 'NONE';
}

export function handleRefused(event: Refused): void {
  const id = actionId(event.transaction.hash, event.logIndex);
  if (Action.load(id) !== null) return;
  const action = new Action(id);
  action.account = event.address;
  action.mandate = mandateEntityId(event.address, event.params.mandateId);
  action.requestId = event.params.requestId;
  action.agent = event.params.agent;
  action.recipient = event.params.recipient;
  action.outcome = 'REFUSED';
  action.rule = ruleName(event.params.rule);
  action.reason = event.params.reason;
  action.attempted = event.params.attempted;
  action.transferred = BigInt.zero();
  action.headroom = event.params.headroom;
  action.spentAfter = event.params.spentAfter;
  action.sequence = event.params.sequence;
  setChainFields(action, event);
  action.save();
}
