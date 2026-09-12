import { parseAbi } from 'viem';

export const golAccountAbi = parseAbi([
  'function owner() view returns (address)',
  'function usdc() view returns (address)',
  'function activeMandateId() view returns (uint256)',
  'function createMandate(address agent,uint256 perPaymentCap,uint256 cumulativeCap,uint64 expiresAt,address[] recipients) returns (uint256 mandateId)',
  'function revokeMandate(uint256 mandateId)',
  'function withdraw(uint256 amount)',
  'function pay(uint256 mandateId,bytes32 requestId,address recipient,uint256 amount) returns (uint8 outcome)',
  'function getMandate(uint256 mandateId) view returns ((address agent,uint256 perPaymentCap,uint256 cumulativeCap,uint256 spent,uint64 expiresAt,bool revoked,bool exists))',
  'function getRecipients(uint256 mandateId) view returns (address[])',
  'function isRecipientAllowed(uint256 mandateId,address recipient) view returns (bool)',
  'function getRequest(uint256 mandateId,bytes32 requestId) view returns ((bytes32 payloadHash,address agent,address recipient,uint256 attempted,uint256 headroom,uint256 spentAfter,uint8 outcome,uint8 rule,string reason,uint64 recordedAt,uint256 sequence))',
  'function remaining(uint256 mandateId) view returns (uint256)',
  'event MandateCreated(uint256 indexed mandateId,address indexed agent,uint256 perPaymentCap,uint256 cumulativeCap,uint64 expiresAt,address[] recipients)',
  'event MandateRevoked(uint256 indexed mandateId,address indexed agent)',
  'event Executed(uint256 indexed mandateId,bytes32 indexed requestId,address indexed agent,address recipient,uint256 amount,uint256 headroom,uint256 spentAfter,uint256 sequence)',
  'event Refused(uint256 indexed mandateId,bytes32 indexed requestId,address indexed agent,address recipient,uint8 rule,uint256 attempted,uint256 headroom,uint256 spentAfter,string reason,uint256 sequence)',
  'event Withdrawn(address indexed owner,uint256 amount)',
]);

export const golAccountFactoryAbi = parseAbi([
  'function usdc() view returns (address)',
  'function accounts(address owner) view returns (address account)',
  'function createAccount() returns (address account)',
  'event AccountCreated(address indexed owner,address indexed account)',
]);

export const erc20Abi = parseAbi([
  'function decimals() view returns (uint8)',
  'function balanceOf(address account) view returns (uint256)',
  'function transfer(address recipient,uint256 amount) returns (bool)',
]);
