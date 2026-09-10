export type GolToolDefinition = {
  name: string;
  title: string;
  description: string;
  category: 'Account' | 'Funding' | 'Mandates' | 'Payments' | 'Activity' | 'Security';
  authority:
    | 'Owner signature'
    | 'Owner consent'
    | 'Owner transfer'
    | 'Restricted agent'
    | 'Read only'
    | 'Owner only';
};

export const GOL_TOOLS = [
  {
    name: 'create_account',
    title: 'Create payment account',
    description:
      'Create the account that holds payment funds and enforces the spending limit you approve.',
    category: 'Account',
    authority: 'Owner signature',
  },
  {
    name: 'provision_agent',
    title: 'Add agent wallet',
    description: 'Create a separate wallet for the agent after you choose who it can pay.',
    category: 'Security',
    authority: 'Owner consent',
  },
  {
    name: 'fund_agent_gas',
    title: 'Add network fee funds',
    description:
      'Add Arc network fees to the agent wallet without changing payment funds or its spending limit.',
    category: 'Funding',
    authority: 'Owner transfer',
  },
  {
    name: 'fund_account',
    title: 'Add payment funds',
    description:
      'Move an exact USDC amount from your personal wallet into the agent payment balance.',
    category: 'Funding',
    authority: 'Owner transfer',
  },
  {
    name: 'withdraw',
    title: 'Withdraw payment funds',
    description:
      'Return available payment funds to your personal wallet. The destination cannot be changed.',
    category: 'Funding',
    authority: 'Owner signature',
  },
  {
    name: 'sign_mandate',
    title: 'Set spending limit',
    description:
      'Choose who the agent may pay, the maximum per payment, total allowed, and end date.',
    category: 'Mandates',
    authority: 'Owner signature',
  },
  {
    name: 'revoke_mandate',
    title: 'Turn off spending rule',
    description: 'Stop the agent from submitting any more payments under the active rule.',
    category: 'Mandates',
    authority: 'Owner signature',
  },
  {
    name: 'preview_instruction',
    title: 'Review payment request',
    description: 'Show the exact amount and allowed recipient before a payment enters the queue.',
    category: 'Payments',
    authority: 'Read only',
  },
  {
    name: 'submit_instruction',
    title: 'Run approved payment',
    description: 'Queue a payment for the agent after it passes the active spending rule.',
    category: 'Payments',
    authority: 'Restricted agent',
  },
  {
    name: 'ask_indexed_question',
    title: 'Ask about payment history',
    description:
      'Answer questions using indexed payment records without asking the agent wallet to sign.',
    category: 'Activity',
    authority: 'Read only',
  },
  {
    name: 'check_indexing',
    title: 'Refresh payment history',
    description:
      'Match pending payment records with confirmed on-chain events and update their status.',
    category: 'Activity',
    authority: 'Read only',
  },
  {
    name: 'export_owner_wallet',
    title: 'Export personal wallet',
    description:
      'Open the sensitive owner-wallet export flow only after showing the required custody warning.',
    category: 'Security',
    authority: 'Owner only',
  },
] as const satisfies readonly GolToolDefinition[];

export const GOL_TOOL_COUNT = GOL_TOOLS.length;
