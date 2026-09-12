export const landingCopy = {
  statusLabel: 'Proposed model / Arc testnet available',
  statusDisclosure:
    'The complete Gol product has not shipped. Values are illustrative; the current Arc testnet build is limited to a payment flow.',
  headline: 'Agents can act. Your limit still decides.',
  refusalLead: 'A $101 request meets a $100 boundary. The refusal becomes a record.',
  authorityLine:
    'You set the mandate. The agent asks through a separate lane. Account policy permits or refuses at execution.',
  shutdownInvariant:
    'Turn Morca servers off. An agent request beyond the implemented payment limit is still refused by the account check.',
  consumerLine: 'You approve an understandable outcome, not an opaque sequence of transactions.',
  closer: 'Set the limit. Send the agent. Keep the proof.',
} as const;

export const designTargetLabel = 'Design target' as const;

export const landingNavItems = [
  { href: '#mandate', label: 'Mandate' },
  { href: '#receipts', label: 'Receipts' },
  { href: '#network', label: 'Adapters' },
  { href: '#status', label: 'Status' },
] as const;

export const illustrativeRequests = [
  {
    id: 'within-limit',
    amountUsd: 100,
    limitUsd: 100,
    outcome: 'allowed',
    rule: 'PER_TX_CAP',
    headroomUsd: 0,
  },
  {
    id: 'over-limit',
    amountUsd: 101,
    limitUsd: 100,
    outcome: 'refused',
    rule: 'PER_TX_CAP',
    headroomUsd: 100,
  },
] as const;

export const enforcementLayers = [
  {
    title: 'Prompt',
    detail: 'rewritten',
    verdict: 'Advisory rule breaks before execution',
  },
  {
    title: 'Framework',
    detail: 'replaced',
    verdict: 'Framework rule breaks before execution',
  },
  {
    title: 'Server',
    detail: 'offline',
    verdict: 'Server rule breaks before execution',
  },
  {
    title: 'Account policy',
    detail: 'still checks',
    verdict: 'Binding check reaches execution',
  },
] as const;

export const policyRoles = [
  {
    title: 'Owner',
    eyebrow: 'Human lane',
    detail: 'Approves the mandate and keeps direct control. Owner actions remain fail-open.',
  },
  {
    title: 'Agent',
    eyebrow: 'Request lane',
    detail: 'Uses scoped, short-lived authority. If a required check fails, nothing happens.',
  },
  {
    title: 'Venue',
    eyebrow: 'Execution edge',
    detail: 'Supplies execution or liquidity behind an adapter. Gol never becomes the venue.',
  },
] as const;

export const authorityStatements = {
  ownerLane: 'Owner lane: direct, owner-signed, fail-open',
  agentLane: 'Agent lane: scoped, checked, fail-closed',
  permission: 'A signer may refuse. Only account policy may permit an agent payment.',
  growth: 'Growth systems may read the trace; they cannot write mandate state.',
  venue: 'GOL is not the venue.',
} as const;

export const policyPath = [
  { label: 'Owner', detail: 'approves mandate' },
  { label: 'Agent request', detail: 'asks under scope' },
  { label: 'Mandate check', detail: 'allows or refuses' },
  { label: 'Execution edge', detail: 'submits allowed call' },
  { label: 'Venue', detail: 'provides the market' },
] as const;

export const mandateControlGroups = [
  {
    title: 'Amount',
    claimState: designTargetLabel,
    items: ['Per transaction', 'Rolling window', 'Per session', 'Lifetime cap'],
  },
  {
    title: 'Destination',
    claimState: designTargetLabel,
    items: ['Recipient', 'Contract target', 'Method', 'Allow and block rules'],
  },
  {
    title: 'Execution',
    claimState: designTargetLabel,
    items: ['Asset', 'Chain', 'Slippage', 'Argument constraints'],
  },
  {
    title: 'Lifecycle',
    claimState: designTargetLabel,
    items: ['Validity window', 'Nonce', 'Revocation reason', 'Recovery policy'],
  },
] as const;

export const receiptModels = [
  {
    title: 'Promised',
    claimState: designTargetLabel,
    detail: 'Expected before execution.',
    fields: [
      ['output', '99.42 units'],
      ['fees', '0.31 units'],
      ['slippage', '0.27%'],
    ],
  },
  {
    title: 'Actual',
    claimState: designTargetLabel,
    detail: 'Observed after execution.',
    fields: [
      ['received', '99.38 units'],
      ['fees', '0.35 units'],
      ['route', '2 legs completed'],
    ],
  },
  {
    title: 'Refused',
    claimState: designTargetLabel,
    detail: 'Stopped with reason and headroom.',
    fields: [
      ['attempted', '101 units'],
      ['rule', 'PER_TX_CAP'],
      ['headroom', '100 units'],
    ],
  },
] as const;

export const marketCategories = [
  {
    title: 'Trade',
    detail: 'Route swaps and orders through bounded intent.',
    claimState: designTargetLabel,
  },
  {
    title: 'Rebalance',
    detail: 'Move toward a target portfolio inside one mandate.',
    claimState: designTargetLabel,
  },
  {
    title: 'Pay',
    detail: 'Let agents pay people, services, or other agents within scope.',
    claimState: designTargetLabel,
  },
  {
    title: 'Borrow and lend',
    detail: 'Prepare position changes with explicit risk constraints.',
    claimState: designTargetLabel,
  },
  {
    title: 'Prediction',
    detail: 'Compare markets without becoming the market.',
    claimState: designTargetLabel,
  },
  {
    title: 'Tokenized assets',
    detail: 'Apply account policy before a routed order.',
    claimState: designTargetLabel,
  },
  {
    title: 'Yield',
    detail: 'Select and monitor non-custodial strategies.',
    claimState: designTargetLabel,
  },
  {
    title: 'Service rails',
    detail: 'Connect off-chain edges through defined adapters.',
    claimState: designTargetLabel,
  },
] as const;

export const prototypeToday = [
  'Arc testnet owner account setup and a mandate-oriented payment flow.',
  'Browser-owned direct owner actions and a separately scoped agent signer path.',
  'An authoritative contract check for the implemented payment rules.',
  'Journal and activity surfaces with explicit fixture and mock labels where applicable.',
] as const;

export const designTargets = [
  'A multi-market, multi-chain account and adapter network.',
  'Full promised-versus-actual receipts and partial-failure recovery.',
  'A generalized agent lane across the planned product surfaces.',
  'Broad venue routing and the complete unified state model.',
  'Production readiness, an independent security audit, and universal venue support.',
  'Mandatory real-user browser acceptance under the current KMS-backed agent signer.',
] as const;
