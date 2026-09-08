import {
  assert,
  beforeAll,
  clearStore,
  describe,
  newMockEvent,
  test,
} from 'matchstick-as/assembly/index';
import { Address, BigInt, Bytes, ethereum } from '@graphprotocol/graph-ts';
import { AccountCreated } from '../generated/GolAccountFactory/GolAccountFactory';
import {
  Executed,
  MandateCreated,
  MandateRevoked,
  Refused,
} from '../generated/templates/GolAccount/GolAccount';
import { handleAccountCreated } from '../src/factory';
import {
  handleExecuted,
  handleMandateCreated,
  handleMandateRevoked,
  handleRefused,
} from '../src/account';

const OWNER = Address.fromString('0x00000000000000000000000000000000000a11ce');
const ACCOUNT = Address.fromString('0x0000000000000000000000000000000000acc017');
const AGENT = Address.fromString('0x00000000000000000000000000000000000a6e17');
const RECIPIENT = Address.fromString('0x000000000000000000000000000000000000beef');
const EXECUTED_TX = Bytes.fromHexString(
  '0x1000000000000000000000000000000000000000000000000000000000000000',
);
const REFUSED_TX = Bytes.fromHexString(
  '0x2000000000000000000000000000000000000000000000000000000000000000',
);

function baseEvent<T extends ethereum.Event>(event: T, address: Address): T {
  event.address = address;
  event.block.number = BigInt.fromI32(100);
  event.block.timestamp = BigInt.fromI32(1_800_000_000);
  event.block.hash = Bytes.fromHexString(
    '0x3000000000000000000000000000000000000000000000000000000000000000',
  );
  return event;
}

function accountCreated(): AccountCreated {
  const event = baseEvent(changetype<AccountCreated>(newMockEvent()), ACCOUNT);
  event.parameters = [
    new ethereum.EventParam('owner', ethereum.Value.fromAddress(OWNER)),
    new ethereum.EventParam('account', ethereum.Value.fromAddress(ACCOUNT)),
  ];
  return event;
}

function mandateCreated(): MandateCreated {
  const event = baseEvent(changetype<MandateCreated>(newMockEvent()), ACCOUNT);
  event.parameters = [
    new ethereum.EventParam('mandateId', ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1))),
    new ethereum.EventParam('agent', ethereum.Value.fromAddress(AGENT)),
    new ethereum.EventParam(
      'perPaymentCap',
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(100_000_000)),
    ),
    new ethereum.EventParam(
      'cumulativeCap',
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(100_000_000)),
    ),
    new ethereum.EventParam(
      'expiresAt',
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(1_800_604_800)),
    ),
    new ethereum.EventParam('recipients', ethereum.Value.fromAddressArray([RECIPIENT])),
  ];
  return event;
}

function executed(): Executed {
  const event = baseEvent(changetype<Executed>(newMockEvent()), ACCOUNT);
  event.transaction.hash = EXECUTED_TX;
  event.logIndex = BigInt.fromI32(4);
  event.parameters = [
    new ethereum.EventParam('mandateId', ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1))),
    new ethereum.EventParam(
      'requestId',
      ethereum.Value.fromFixedBytes(
        Bytes.fromHexString('0x0100000000000000000000000000000000000000000000000000000000000000'),
      ),
    ),
    new ethereum.EventParam('agent', ethereum.Value.fromAddress(AGENT)),
    new ethereum.EventParam('recipient', ethereum.Value.fromAddress(RECIPIENT)),
    new ethereum.EventParam(
      'amount',
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(40_000_000)),
    ),
    new ethereum.EventParam(
      'headroom',
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(60_000_000)),
    ),
    new ethereum.EventParam(
      'spentAfter',
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(40_000_000)),
    ),
    new ethereum.EventParam('sequence', ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1))),
  ];
  return event;
}

function refused(): Refused {
  const event = baseEvent(changetype<Refused>(newMockEvent()), ACCOUNT);
  event.transaction.hash = REFUSED_TX;
  event.logIndex = BigInt.fromI32(5);
  event.parameters = [
    new ethereum.EventParam('mandateId', ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1))),
    new ethereum.EventParam(
      'requestId',
      ethereum.Value.fromFixedBytes(
        Bytes.fromHexString('0x0200000000000000000000000000000000000000000000000000000000000000'),
      ),
    ),
    new ethereum.EventParam('agent', ethereum.Value.fromAddress(AGENT)),
    new ethereum.EventParam('recipient', ethereum.Value.fromAddress(RECIPIENT)),
    new ethereum.EventParam('rule', ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(5))),
    new ethereum.EventParam(
      'attempted',
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(70_000_000)),
    ),
    new ethereum.EventParam(
      'headroom',
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(60_000_000)),
    ),
    new ethereum.EventParam(
      'spentAfter',
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(40_000_000)),
    ),
    new ethereum.EventParam('reason', ethereum.Value.fromString('Cumulative cap exceeded')),
    new ethereum.EventParam('sequence', ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(2))),
  ];
  return event;
}

describe('Gol account mappings', () => {
  beforeAll(() => {
    clearStore();
    handleAccountCreated(accountCreated());
    handleMandateCreated(mandateCreated());
    handleExecuted(executed());
    handleRefused(refused());
  });

  test('indexes the exact 100, 40, 70 scenario', () => {
    const mandate = ACCOUNT.toHexString().toLowerCase() + ':1';
    assert.fieldEquals('Mandate', mandate, 'cumulativeCap', '100000000');
    assert.fieldEquals('Mandate', mandate, 'spent', '40000000');

    const action = REFUSED_TX.concatI32(5).toHexString();
    assert.fieldEquals('Action', action, 'outcome', 'REFUSED');
    assert.fieldEquals('Action', action, 'rule', 'CUMULATIVE_CAP');
    assert.fieldEquals('Action', action, 'attempted', '70000000');
    assert.fieldEquals('Action', action, 'transferred', '0');
    assert.fieldEquals('Action', action, 'headroom', '60000000');
    assert.fieldEquals('Action', action, 'spentAfter', '40000000');
    assert.fieldEquals('Action', action, 'transactionHash', REFUSED_TX.toHexString());
    assert.entityCount('Action', 2);
  });

  test('uses deterministic IDs and ignores duplicate event ingestion', () => {
    handleRefused(refused());
    assert.entityCount('Action', 2);
  });

  test('retains actions when a mandate is revoked', () => {
    const event = baseEvent(changetype<MandateRevoked>(newMockEvent()), ACCOUNT);
    event.parameters = [
      new ethereum.EventParam('mandateId', ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1))),
      new ethereum.EventParam('agent', ethereum.Value.fromAddress(AGENT)),
    ];
    handleMandateRevoked(event);
    assert.fieldEquals('Mandate', ACCOUNT.toHexString().toLowerCase() + ':1', 'revoked', 'true');
    assert.entityCount('Action', 2);
  });
});
