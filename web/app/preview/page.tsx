import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileText,
  Gift,
  History,
  Layers3,
  LockKeyhole,
  Moon,
  Network,
  Route,
  Search,
  ShieldCheck,
  Sun,
  Vote,
  XCircle,
} from 'lucide-react';
import { AaveLogo } from '@/components/ui/aave-logo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GolLogo } from '@/components/ui/gol-logo';
import { TokenIcon } from '@/components/ui/token-icon';

export const metadata: Metadata = {
  title: 'GOL tool cards',
  description: 'Static preview gallery for GOL Agent tool and transaction cards',
  robots: { index: false, follow: false },
};

type ToolCardProps = {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  children: ReactNode;
};

const markets = [
  { symbol: 'USDC', supply: '4.52%', borrow: '5.41%' },
  { symbol: 'GHO', supply: '3.90%', borrow: '6.20%' },
  { symbol: 'WETH', supply: '1.63%', borrow: '2.31%' },
  { symbol: 'cbETH', supply: '0.08%', borrow: '1.90%' },
  { symbol: 'cbBTC', supply: '0.02%', borrow: '1.40%' },
];

const assets = [
  {
    symbol: 'USDC',
    detail: '4.52% APY',
    address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  },
  {
    symbol: 'GHO',
    detail: '3.90% APY',
    address: '0x6Bb7a212910682DCFdbd5BCBb3e28FB4E8da10Ee',
  },
  {
    symbol: 'WETH',
    detail: '1.63% APY',
    address: '0x4200000000000000000000000000000000000006',
  },
  {
    symbol: 'cbETH',
    detail: '0.08% APY',
    address: '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22',
  },
  {
    symbol: 'cbBTC',
    detail: '0.02% APY',
    address: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf',
  },
  {
    symbol: 'AAVE',
    detail: '0.01% APY',
    address: '0x63706e401c06ac8513145b7687A14804d17f814b',
  },
];

const apyBars = [
  'h-6',
  'h-7',
  'h-8',
  'h-10',
  'h-9',
  'h-11',
  'h-12',
  'h-10',
  'h-13',
  'h-12',
  'h-14',
  'h-13',
];

const aaveToolGroups = [
  {
    title: 'Networks and markets',
    description: 'Discover supported chains, reserves, rates, eMode categories, and v4 hubs.',
    tools: [
      'get_chains',
      'get_markets',
      'get_emode_categories',
      'get_reserve_details',
      'get_apy_history',
      'get_protocol_history',
      'get_hubs',
      'get_hub_assets',
    ],
  },
  {
    title: 'Positions and activity',
    description: 'Inspect wallet positions, health, rewards, activity, and transaction processing.',
    tools: [
      'get_user_positions',
      'get_position_items',
      'get_user_summary',
      'get_transaction_processed',
      'get_user_activity',
      'get_user_summary_history',
      'get_user_rewards',
    ],
  },
  {
    title: 'Action preparation',
    description: 'Build or simulate unsigned Aave actions before the owner reviews them.',
    tools: [
      'prepare_liquidation',
      'prepare_set_emode',
      'prepare_action',
      'prepare_set_collateral',
      'preview_action',
      'prepare_claim_rewards',
    ],
  },
  {
    title: 'Swaps and orders',
    description: 'Quote, prepare, monitor, submit, or cancel Aave swap orders.',
    tools: [
      'get_swappable_tokens',
      'get_swap_quote',
      'prepare_order',
      'submit_signed_order',
      'prepare_cancel_order',
      'cancel_order',
      'get_order_status',
      'get_pending_orders',
    ],
  },
  {
    title: 'sGHO and migration',
    description: 'Read the savings vault and prepare sGHO deposits, withdrawals, or migrations.',
    tools: ['get_sgho_vault', 'get_sgho_preview', 'prepare_sgho_action', 'prepare_stkgho_migrate'],
  },
  {
    title: 'Governance and guidance',
    description: 'Read proposals, votes, payloads, and Aave connector guidance.',
    tools: [
      'search_governance_proposals',
      'get_governance_proposal',
      'get_proposal_votes',
      'get_user_vote',
      'get_proposal_payloads',
      'get_aave_guide',
      'get_started',
    ],
  },
] as const;

const tokenAddresses = {
  AAVE: '0x63706e401c06ac8513145b7687A14804d17f814b',
  cbBTC: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf',
  cbETH: '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22',
  ETH: 'eth-native-base',
  GHO: '0x6Bb7a212910682DCFdbd5BCBb3e28FB4E8da10Ee',
  USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  WETH: '0x4200000000000000000000000000000000000006',
} as const;

const gatedAaveTools = new Set(['submit_signed_order', 'cancel_order']);

const aaveToolTitles: Record<string, string> = {
  get_chains: 'Supported chains',
  get_markets: 'Markets and reserves',
  get_emode_categories: 'Efficiency mode categories',
  get_user_positions: 'Aave user positions',
  get_position_items: 'Position assets and debts',
  get_user_summary: 'Aave user summary',
  get_transaction_processed: 'Transaction processing status',
  get_reserve_details: 'Reserve details',
  get_apy_history: 'APY history',
  get_user_activity: 'Aave user activity',
  get_protocol_history: 'Protocol history',
  get_user_summary_history: 'Position history',
  get_hubs: 'Aave v4 hubs',
  get_hub_assets: 'Hub assets',
  prepare_liquidation: 'Prepare liquidation',
  prepare_set_emode: 'Prepare efficiency mode',
  prepare_action: 'Prepare lending action',
  prepare_set_collateral: 'Prepare collateral setting',
  preview_action: 'Simulate Aave action',
  get_swappable_tokens: 'Swappable tokens',
  get_swap_quote: 'Swap quote',
  prepare_order: 'Prepare swap order',
  submit_signed_order: 'Submit signed order',
  prepare_cancel_order: 'Prepare order cancellation',
  cancel_order: 'Cancel signed order',
  get_order_status: 'Order status',
  get_pending_orders: 'Pending orders',
  get_user_rewards: 'Aave rewards',
  prepare_claim_rewards: 'Prepare rewards claim',
  get_sgho_vault: 'sGHO savings vault',
  get_sgho_preview: 'sGHO action preview',
  prepare_sgho_action: 'Prepare sGHO action',
  prepare_stkgho_migrate: 'Prepare stkGHO migration',
  search_governance_proposals: 'Search governance proposals',
  get_governance_proposal: 'Governance proposal',
  get_proposal_votes: 'Proposal votes',
  get_user_vote: 'Owner vote',
  get_proposal_payloads: 'Proposal execution payloads',
  get_aave_guide: 'Aave usage guide',
  get_started: 'Aave connector capabilities',
};

const golActions = [
  {
    name: 'create_account',
    title: 'Create GOL account',
    description: 'Deploy the owner-controlled smart-contract account.',
    authority: 'Owner signature',
  },
  {
    name: 'provision_agent',
    title: 'Provision restricted agent',
    description: 'Create the separate signer after recipient and policy consent.',
    authority: 'Owner consent',
  },
  {
    name: 'fund_agent_gas',
    title: 'Fund agent gas',
    description: 'Top up gas outside the mandate account budget.',
    authority: 'Owner transfer',
  },
  {
    name: 'fund_account',
    title: 'Deposit to GOL account',
    description: 'Transfer an exact USDC amount from the owner wallet.',
    authority: 'Owner transfer',
  },
  {
    name: 'withdraw',
    title: 'Withdraw account funds',
    description: 'Return value only to the account’s immutable owner.',
    authority: 'Owner signature',
  },
  {
    name: 'sign_mandate',
    title: 'Create mandate',
    description: 'Approve agent, recipient, caps, and expiry as one owner mandate.',
    authority: 'Owner signature',
  },
  {
    name: 'revoke_mandate',
    title: 'Revoke mandate',
    description: 'Remove the agent’s authority for the active mandate.',
    authority: 'Owner signature',
  },
  {
    name: 'preview_instruction',
    title: 'Resolve payment instruction',
    description: 'Parse recipient and exact token amount before queueing work.',
    authority: 'Read only',
  },
  {
    name: 'submit_instruction',
    title: 'Submit agent payment',
    description: 'Queue an idempotent request governed by the active mandate.',
    authority: 'Restricted agent',
  },
  {
    name: 'ask_indexed_question',
    title: 'Ask about activity',
    description: 'Answer from indexed evidence without reaching the signer.',
    authority: 'Read only',
  },
  {
    name: 'check_indexing',
    title: 'Refresh indexed activity',
    description: 'Reconcile pending journal records with indexed chain events.',
    authority: 'Read only',
  },
  {
    name: 'export_owner_wallet',
    title: 'Export owner wallet',
    description: 'Open Privy’s sensitive owner-only export flow after a warning.',
    authority: 'Owner only',
  },
] as const;

function ToolCard({ title, subtitle, icon, children }: ToolCardProps) {
  return (
    <Card className="my-1.5 w-full max-w-md shadow-panel">
      <CardHeader className="flex-row items-center justify-between gap-3 p-4 pb-0">
        <div className="flex min-w-0 items-center gap-2">
          {icon}
          <CardTitle className="truncate text-sm">{title}</CardTitle>
        </div>
        {subtitle && (
          <Badge variant="secondary" className="shrink-0 uppercase tracking-wide">
            {subtitle}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="p-4 pt-3">{children}</CardContent>
    </Card>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'warn' }) {
  return (
    <div className="rounded-xl bg-muted px-3 py-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div
        className={
          tone === 'good'
            ? 'text-sm font-medium text-success'
            : tone === 'warn'
              ? 'text-sm font-medium text-warning'
              : 'text-sm font-medium text-foreground'
        }
      >
        {value}
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  const title = label
    .replaceAll('_', ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (character) => character.toUpperCase());
  return (
    <section className="flex flex-col items-center gap-1" aria-label={label}>
      <h2 className="font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

function TokenTile({
  symbol,
  detail,
  address,
}: {
  symbol: string;
  detail: string;
  address: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-xl bg-muted px-2.5 py-2">
      <TokenIcon address={address} symbol={symbol} className="size-7 shrink-0" />
      <div className="min-w-0">
        <div className="truncate text-xs font-medium">{symbol}</div>
        <div className="truncate text-[11px] text-success">{detail}</div>
      </div>
    </div>
  );
}

function ReviewCard({
  title,
  description,
  protocol = 'Aave',
  status = 'Owner review',
}: {
  title: string;
  description: string;
  protocol?: string;
  status?: string;
}) {
  return (
    <Card className="my-1.5 w-full max-w-md overflow-hidden shadow-panel">
      <CardHeader className="flex-row items-center justify-between border-b border-border p-4 py-3">
        <div className="flex items-center gap-2">
          {protocol.toLowerCase().startsWith('aave') ? (
            <AaveLogo className="size-6 text-primary" />
          ) : protocol.toLowerCase().startsWith('gol') ? (
            <GolLogo className="size-6" />
          ) : (
            <ShieldCheck className="size-6 text-primary" />
          )}
          <CardTitle className="text-xs">{protocol}</CardTitle>
        </div>
        <Badge variant="secondary">{status}</Badge>
      </CardHeader>
      <CardContent className="p-4">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="mt-1 text-xs leading-copy text-muted-foreground">{description}</p>
        <div className="mt-4 flex gap-2">
          <Button
            size="sm"
            aria-disabled
            tabIndex={-1}
            className="pointer-events-none rounded-full"
          >
            Review request
          </Button>
          <Button
            size="sm"
            variant="outline"
            aria-disabled
            tabIndex={-1}
            className="pointer-events-none rounded-full"
          >
            Cancel
          </Button>
        </div>
        <p className="mt-3 text-[10px] text-muted-foreground">
          Static preview only. No wallet request will be created.
        </p>
      </CardContent>
    </Card>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted px-3 py-2">
      <span className="block text-[10px] text-muted-foreground">{label}</span>
      <strong className="mt-0.5 block text-sm">{value}</strong>
    </div>
  );
}

function AssetLine({
  symbol,
  value,
  detail,
}: {
  symbol: keyof typeof tokenAddresses;
  value: string;
  detail?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-muted px-3 py-2">
      <span className="flex min-w-0 items-center gap-2">
        <TokenIcon address={tokenAddresses[symbol]} symbol={symbol} className="size-6 shrink-0" />
        <span className="truncate text-xs font-medium">{symbol}</span>
      </span>
      <span className="text-right">
        <strong className="block text-xs">{value}</strong>
        {detail && <span className="block text-[10px] text-muted-foreground">{detail}</span>}
      </span>
    </div>
  );
}

function ToolVisual({ tool }: { tool: string }) {
  switch (tool) {
    case 'get_chains':
      return (
        <div className="grid grid-cols-2 gap-2">
          {['Ethereum', 'Base', 'Arbitrum', 'Optimism'].map((chain) => (
            <div key={chain} className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2">
              <Network size={14} className="text-primary" />
              <span className="text-xs">{chain}</span>
            </div>
          ))}
        </div>
      );
    case 'get_markets':
      return (
        <div className="space-y-2">
          <AssetLine symbol="USDC" value="4.52%" detail="Supply APY" />
          <AssetLine symbol="GHO" value="3.90%" detail="Supply APY" />
        </div>
      );
    case 'get_emode_categories':
      return (
        <div className="rounded-xl bg-accent p-3">
          <Badge>Stablecoins</Badge>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <MiniMetric label="Max LTV" value="93%" />
            <MiniMetric label="Liquidation" value="95%" />
          </div>
        </div>
      );
    case 'get_reserve_details':
      return (
        <div>
          <div className="flex items-end justify-between">
            <span className="text-xs text-muted-foreground">USDC utilization</span>
            <strong className="text-lg">82.31%</strong>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
            <div className="h-full w-4/5 rounded-full bg-primary" />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <MiniMetric label="Reserve factor" value="10%" />
            <MiniMetric label="Available" value="$18.4M" />
          </div>
        </div>
      );
    case 'get_apy_history':
      return (
        <div>
          <div className="flex items-baseline justify-between">
            <strong className="text-2xl text-success">4.52%</strong>
            <span className="text-[10px] text-muted-foreground">30 day average 4.18%</span>
          </div>
          <div className="mt-3 flex h-12 items-end gap-1">
            {apyBars.slice(0, 8).map((height, index) => (
              <span
                key={`${height}-${index}`}
                className={`flex-1 rounded-sm bg-success/70 ${height}`}
              />
            ))}
          </div>
        </div>
      );
    case 'get_protocol_history':
      return (
        <div className="grid grid-cols-2 gap-2">
          <MiniMetric label="Protocol TVL" value="$18.2B" />
          <MiniMetric label="30 day change" value="+6.4%" />
          <MiniMetric label="Borrowed" value="$7.1B" />
          <MiniMetric label="Active markets" value="154" />
        </div>
      );
    case 'get_hubs':
      return (
        <div className="space-y-2">
          {['Core Hub', 'Stablecoin Hub'].map((hub, index) => (
            <div key={hub} className="flex items-center justify-between rounded-lg bg-muted p-3">
              <span className="flex items-center gap-2 text-xs font-medium">
                <Layers3 size={14} className="text-primary" /> {hub}
              </span>
              <Badge variant="secondary">{index === 0 ? '12 spokes' : '6 spokes'}</Badge>
            </div>
          ))}
        </div>
      );
    case 'get_hub_assets':
      return (
        <div className="grid grid-cols-2 gap-2">
          <TokenTile symbol="USDC" detail="$640M" address={tokenAddresses.USDC} />
          <TokenTile symbol="WETH" detail="$410M" address={tokenAddresses.WETH} />
          <TokenTile symbol="GHO" detail="$92M" address={tokenAddresses.GHO} />
          <TokenTile symbol="AAVE" detail="$31M" address={tokenAddresses.AAVE} />
        </div>
      );
    case 'get_user_positions':
      return (
        <div className="space-y-2">
          <AssetLine symbol="USDC" value="$1,000" detail="Supplied" />
          <AssetLine symbol="WETH" value="$420.15" detail="Borrowed" />
        </div>
      );
    case 'get_position_items':
      return (
        <div className="grid grid-cols-2 gap-2">
          <MiniMetric label="Collateral items" value="2" />
          <MiniMetric label="Debt items" value="1" />
          <MiniMetric label="Hub" value="Core" />
          <MiniMetric label="Spoke" value="Base" />
        </div>
      );
    case 'get_user_summary':
      return (
        <div className="flex items-center justify-between rounded-xl bg-muted p-4">
          <div>
            <span className="text-[10px] text-muted-foreground">Health factor</span>
            <strong className="block text-3xl text-success">1.85</strong>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-muted-foreground">Net worth</span>
            <strong className="block text-sm">$14,902.74</strong>
          </div>
        </div>
      );
    case 'get_transaction_processed':
      return (
        <div className="flex items-center gap-3 rounded-xl bg-success/10 p-4 text-success">
          <CheckCircle2 size={22} />
          <div>
            <strong className="block text-sm">Transaction processed</strong>
            <code className="text-[10px]">0x91c4…d210</code>
          </div>
        </div>
      );
    case 'get_user_activity':
      return (
        <div className="space-y-2 text-xs">
          <div className="flex justify-between rounded-lg bg-muted p-3">
            <span>Supply USDC</span>
            <strong className="text-success">+$1,000</strong>
          </div>
          <div className="flex justify-between rounded-lg bg-muted p-3">
            <span>Borrow WETH</span>
            <strong className="text-warning">-$420.15</strong>
          </div>
        </div>
      );
    case 'get_user_summary_history':
      return (
        <div>
          <div className="flex items-center gap-2 text-xs text-success">
            <History size={15} /> Net worth increased 8.2%
          </div>
          <div className="mt-3 flex h-12 items-end gap-1">
            {['h-5', 'h-6', 'h-7', 'h-8', 'h-9', 'h-10', 'h-12'].map((height) => (
              <span key={height} className={`flex-1 rounded-sm bg-primary/70 ${height}`} />
            ))}
          </div>
        </div>
      );
    case 'get_user_rewards':
      return (
        <div className="flex items-center justify-between rounded-xl bg-muted p-3">
          <span className="flex items-center gap-2">
            <TokenIcon address={tokenAddresses.AAVE} symbol="AAVE" className="size-8" />
            <span>
              <strong className="block text-sm">2.48 AAVE</strong>
              <span className="text-[10px] text-muted-foreground">Claimable</span>
            </span>
          </span>
          <Gift size={20} className="text-primary" />
        </div>
      );
    case 'prepare_liquidation':
      return (
        <div className="rounded-xl border border-warning/20 bg-warning/10 p-3">
          <div className="flex items-center justify-between text-xs">
            <span>Repay debt</span>
            <strong>1,000 USDC</strong>
          </div>
          <div className="my-2 flex justify-center">
            <ArrowRight size={15} className="text-warning" />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span>Receive collateral</span>
            <strong>0.31 WETH</strong>
          </div>
        </div>
      );
    case 'prepare_set_emode':
      return (
        <div className="flex items-center justify-between rounded-xl bg-muted p-3 text-xs">
          <Badge variant="secondary">Standard</Badge>
          <ArrowRight size={15} />
          <Badge>Stablecoins</Badge>
        </div>
      );
    case 'prepare_action':
      return (
        <div className="space-y-2">
          <AssetLine symbol="USDC" value="100.00" detail="Supply" />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Transaction</span>
            <span>Unsigned</span>
          </div>
        </div>
      );
    case 'prepare_set_collateral':
      return (
        <div className="flex items-center justify-between rounded-xl bg-muted p-3">
          <span className="flex items-center gap-2">
            <TokenIcon address={tokenAddresses.cbETH} symbol="cbETH" className="size-7" />
            <span className="text-xs font-medium">cbETH collateral</span>
          </span>
          <Badge>Enabled</Badge>
        </div>
      );
    case 'preview_action':
      return (
        <div className="space-y-2">
          {['Simulation passed', 'Health factor remains safe', 'No value submitted'].map((item) => (
            <div key={item} className="flex items-center gap-2 text-xs">
              <CheckCircle2 size={14} className="text-success" />
              {item}
            </div>
          ))}
        </div>
      );
    case 'prepare_claim_rewards':
      return (
        <div className="rounded-xl bg-muted p-3">
          <AssetLine symbol="AAVE" value="2.48" detail="Claimable" />
          <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
            <span>Destination</span>
            <span>Owner wallet</span>
          </div>
        </div>
      );
    case 'get_swappable_tokens':
      return (
        <div className="flex items-center justify-between rounded-xl bg-muted p-3">
          {(['USDC', 'GHO', 'WETH', 'AAVE'] as const).map((symbol) => (
            <TokenIcon
              key={symbol}
              address={tokenAddresses[symbol]}
              symbol={symbol}
              className="size-9"
            />
          ))}
        </div>
      );
    case 'get_swap_quote':
      return (
        <div className="flex items-center justify-between rounded-xl bg-muted p-3">
          <span className="flex items-center gap-2">
            <TokenIcon address={tokenAddresses.USDC} symbol="USDC" className="size-8" />
            <strong className="text-sm">100</strong>
          </span>
          <Route size={17} className="text-primary" />
          <span className="flex items-center gap-2">
            <strong className="text-sm">0.052</strong>
            <TokenIcon address={tokenAddresses.WETH} symbol="WETH" className="size-8" />
          </span>
        </div>
      );
    case 'prepare_order':
      return (
        <div className="space-y-2">
          {['Quote locked', 'Approval prepared', 'Owner signature required'].map((step, index) => (
            <div
              key={step}
              className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-xs"
            >
              <span>
                {index + 1}. {step}
              </span>
              {index < 2 ? (
                <CheckCircle2 size={14} className="text-success" />
              ) : (
                <LockKeyhole size={14} className="text-warning" />
              )}
            </div>
          ))}
        </div>
      );
    case 'submit_signed_order':
      return (
        <div className="flex gap-3 rounded-xl bg-warning/10 p-3">
          <LockKeyhole className="size-5 shrink-0 text-warning" />
          <p className="text-xs leading-copy text-muted-foreground">
            Accepts only an order already signed by the authenticated owner wallet.
          </p>
        </div>
      );
    case 'prepare_cancel_order':
      return (
        <div className="rounded-xl bg-muted p-3">
          <span className="text-[10px] text-muted-foreground">Order to cancel</span>
          <code className="mt-1 block text-xs">order_7a31…9f2c</code>
          <Badge variant="warning" className="mt-3">
            Signature required
          </Badge>
        </div>
      );
    case 'cancel_order':
      return (
        <div className="flex items-center justify-between rounded-xl border border-warning/20 p-3">
          <span className="text-xs">Signed cancellation</span>
          <Badge variant="warning">Wallet gated</Badge>
        </div>
      );
    case 'get_order_status':
      return (
        <div className="rounded-xl bg-success/10 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">Order filled</span>
            <Badge>100%</Badge>
          </div>
          <div className="mt-3 h-2 rounded-full bg-success" />
        </div>
      );
    case 'get_pending_orders':
      return (
        <div className="space-y-2">
          <div className="flex justify-between rounded-lg bg-muted p-3 text-xs">
            <span>USDC → WETH</span>
            <Badge variant="warning">Pending</Badge>
          </div>
          <div className="flex justify-between rounded-lg bg-muted p-3 text-xs">
            <span>GHO → USDC</span>
            <Badge variant="secondary">Partially filled</Badge>
          </div>
        </div>
      );
    case 'get_sgho_vault':
      return (
        <div className="grid grid-cols-2 gap-2">
          <MiniMetric label="Vault APY" value="5.21%" />
          <MiniMetric label="Total assets" value="92.4M GHO" />
        </div>
      );
    case 'get_sgho_preview':
      return (
        <div className="flex items-center justify-between rounded-xl bg-muted p-3 text-xs">
          <span>100 GHO</span>
          <ArrowRight size={15} className="text-primary" />
          <strong>99.98 sGHO</strong>
        </div>
      );
    case 'prepare_sgho_action':
      return (
        <div className="space-y-2">
          <AssetLine symbol="GHO" value="100.00" detail="Deposit" />
          <Badge>Unsigned vault action</Badge>
        </div>
      );
    case 'prepare_stkgho_migrate':
      return (
        <div className="flex items-center justify-between rounded-xl bg-muted p-3">
          <Badge variant="secondary">stkGHO</Badge>
          <ArrowRight size={15} />
          <Badge>sGHO</Badge>
        </div>
      );
    case 'search_governance_proposals':
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs">
            <Search size={14} className="text-primary" />2 matching proposals
          </div>
          <div className="rounded-lg bg-muted p-3 text-xs">AIP-248: GHO liquidity incentives</div>
        </div>
      );
    case 'get_governance_proposal':
      return (
        <div className="rounded-xl bg-muted p-3">
          <div className="flex items-center justify-between">
            <strong className="text-xs">AIP-248</strong>
            <Badge>Active</Badge>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">GHO liquidity incentives</p>
        </div>
      );
    case 'get_proposal_votes':
      return (
        <div>
          <div className="flex justify-between text-xs">
            <span className="text-success">For 82%</span>
            <span className="text-warning">Against 18%</span>
          </div>
          <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-warning">
            <span className="w-4/5 bg-success" />
          </div>
        </div>
      );
    case 'get_user_vote':
      return (
        <div className="flex items-center justify-between rounded-xl bg-muted p-3">
          <span className="flex items-center gap-2 text-xs">
            <Vote size={15} className="text-primary" />
            Owner vote
          </span>
          <Badge variant="secondary">Not voted</Badge>
        </div>
      );
    case 'get_proposal_payloads':
      return (
        <div className="space-y-2">
          <div className="flex justify-between rounded-lg bg-muted p-3 text-xs">
            <span>Base payload</span>
            <strong>2 actions</strong>
          </div>
          <div className="flex justify-between rounded-lg bg-muted p-3 text-xs">
            <span>Ethereum payload</span>
            <strong>1 action</strong>
          </div>
        </div>
      );
    case 'get_aave_guide':
      return (
        <div className="flex flex-wrap gap-2">
          {['Supply', 'Borrow', 'Repay', 'Risk'].map((topic) => (
            <Badge key={topic} variant="secondary">
              <FileText size={11} />
              {topic}
            </Badge>
          ))}
        </div>
      );
    case 'get_started':
      return (
        <div className="space-y-2">
          {['Read markets', 'Inspect positions', 'Prepare actions'].map((item) => (
            <div key={item} className="flex items-center gap-2 text-xs">
              <CheckCircle2 size={14} className="text-success" />
              {item}
            </div>
          ))}
        </div>
      );
    default:
      return <p className="text-xs text-muted-foreground">Tool preview available.</p>;
  }
}

function AaveCatalogCard({ tool }: { tool: string }) {
  const gated = gatedAaveTools.has(tool);
  const title = aaveToolTitles[tool] ?? tool.replaceAll('_', ' ');
  return (
    <Card className="h-full overflow-hidden shadow-panel" data-aave-tool={tool}>
      <CardHeader className="flex-row items-center justify-between gap-3 border-b border-border p-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <AaveLogo className="size-5 shrink-0 text-primary" />
          <CardTitle className="truncate text-sm">{title}</CardTitle>
        </div>
        <Badge variant={gated ? 'warning' : 'secondary'} className="shrink-0">
          {gated ? 'Wallet gated' : tool.startsWith('prepare_') ? 'Prepare' : 'Read'}
        </Badge>
      </CardHeader>
      <CardContent className="p-4">
        <ToolVisual tool={tool} />
        <code className="mt-3 block truncate text-[10px] text-muted-foreground">{tool}</code>
      </CardContent>
    </Card>
  );
}

function GolActionVisual({ name }: { name: (typeof golActions)[number]['name'] }) {
  switch (name) {
    case 'create_account':
      return (
        <div className="flex items-center justify-between rounded-lg bg-muted p-3 text-xs">
          <span>Owner wallet</span>
          <ArrowRight size={14} />
          <strong>GOL account</strong>
        </div>
      );
    case 'provision_agent':
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs">
            <CheckCircle2 size={14} className="text-success" />
            Recipient approved
          </div>
          <div className="flex items-center gap-2 text-xs">
            <ShieldCheck size={14} className="text-primary" />
            Denied by default policy
          </div>
        </div>
      );
    case 'fund_agent_gas':
      return (
        <div className="flex items-center justify-between rounded-lg bg-muted p-3 text-xs">
          <strong>1 USDC</strong>
          <ArrowRight size={14} />
          <span>Agent gas reserve</span>
        </div>
      );
    case 'fund_account':
      return (
        <div className="flex items-center justify-between rounded-lg bg-muted p-3 text-xs">
          <span>Owner</span>
          <strong className="text-primary">100 USDC</strong>
          <span>GOL account</span>
        </div>
      );
    case 'withdraw':
      return (
        <div className="rounded-lg bg-muted p-3">
          <div className="flex items-center justify-between text-xs">
            <span>GOL account</span>
            <ArrowRight size={14} />
            <span>Immutable owner</span>
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">Destination cannot be changed.</p>
        </div>
      );
    case 'sign_mandate':
      return (
        <div className="grid grid-cols-2 gap-2">
          <MiniMetric label="Per payment" value="90 USDC" />
          <MiniMetric label="Cumulative" value="100 USDC" />
          <MiniMetric label="Recipient" value="Approved" />
          <MiniMetric label="Expires" value="7 days" />
        </div>
      );
    case 'revoke_mandate':
      return (
        <div className="flex items-center gap-3 rounded-lg bg-warning/10 p-3">
          <XCircle size={18} className="text-warning" />
          <div>
            <strong className="block text-xs">Mandate revoked</strong>
            <span className="text-[10px] text-muted-foreground">Agent authority removed</span>
          </div>
        </div>
      );
    case 'preview_instruction':
      return (
        <div className="flex items-center justify-between rounded-lg bg-muted p-3">
          <div>
            <span className="text-[10px] text-muted-foreground">Exact amount</span>
            <strong className="block text-lg">40 USDC</strong>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-muted-foreground">Recipient</span>
            <strong className="block text-xs">Design contractor</strong>
          </div>
        </div>
      );
    case 'submit_instruction':
      return (
        <div className="flex items-center justify-between text-[10px]">
          <Badge variant="secondary">Queued</Badge>
          <ArrowRight size={13} />
          <Badge variant="warning">Policy check</Badge>
          <ArrowRight size={13} />
          <Badge>Recorded</Badge>
        </div>
      );
    case 'ask_indexed_question':
      return (
        <div className="rounded-lg bg-muted p-3">
          <div className="flex items-center gap-2 text-xs">
            <Search size={14} className="text-primary" />
            Why was payment refused?
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
            <span>2 indexed records</span>
            <span>1 citation</span>
          </div>
        </div>
      );
    case 'check_indexing':
      return (
        <div className="grid grid-cols-2 gap-2">
          <MiniMetric label="Pending" value="0" />
          <MiniMetric label="Indexed" value="2" />
        </div>
      );
    case 'export_owner_wallet':
      return (
        <div className="flex gap-3 rounded-lg bg-warning/10 p-3">
          <LockKeyhole className="size-5 shrink-0 text-warning" />
          <p className="text-xs leading-copy text-muted-foreground">
            Private key export stays inside Privy’s owner-only warning flow.
          </p>
        </div>
      );
  }
}

function GolActionCard({ action }: { action: (typeof golActions)[number] }) {
  const restrictedAgent = action.authority === 'Restricted agent';

  return (
    <Card className="h-full shadow-panel" data-gol-action={action.name}>
      <CardHeader className="p-4 pb-0">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <GolLogo className="size-5 shrink-0" />
            <CardTitle className="truncate text-sm">{action.title}</CardTitle>
          </div>
          <Badge variant={restrictedAgent ? 'warning' : 'secondary'} className="shrink-0">
            {action.authority}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-3">
        <p className="text-xs leading-copy text-muted-foreground">{action.description}</p>
        <div className="mt-4">
          <GolActionVisual name={action.name} />
        </div>
        <code className="mt-3 block truncate text-[10px] text-muted-foreground">{action.name}</code>
      </CardContent>
    </Card>
  );
}

export default async function PreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ theme?: string | string[] | undefined }>;
}) {
  const requestedTheme = (await searchParams).theme;
  const theme = requestedTheme === 'light' ? 'light' : 'dark';

  return (
    <main
      className={`theme-${theme} min-h-screen bg-background px-4 py-8 text-foreground sm:px-8 sm:py-10`}
    >
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <img src="/gol-mark-blue.svg" alt="" className="size-8" />
              <span className="font-mono text-xs font-semibold uppercase tracking-[.2em] text-primary">
                GOL Network
              </span>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">GOL tool cards</h1>
            <p className="mt-2 max-w-xl text-sm leading-copy text-muted-foreground">
              Static gallery for agent reads, unsigned action previews, mandate execution, and
              refusal outcomes.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex rounded-lg border border-border bg-card p-1">
              <Button
                asChild
                variant={theme === 'light' ? 'secondary' : 'ghost'}
                size="icon"
                className="size-7"
              >
                <a href="/preview?theme=light" aria-label="Use light theme">
                  <Sun size={14} />
                </a>
              </Button>
              <Button
                asChild
                variant={theme === 'dark' ? 'secondary' : 'ghost'}
                size="icon"
                className="size-7"
              >
                <a href="/preview?theme=dark" aria-label="Use dark theme">
                  <Moon size={14} />
                </a>
              </Button>
            </div>
            <Badge variant="warning">Fixture data</Badge>
            <Button asChild variant="outline" size="sm">
              <a href="/">
                <ArrowLeft size={14} /> GOL home
              </a>
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3">
          <Section label="get_account_state">
            <ToolCard
              title="GOL account"
              subtitle="Arc testnet"
              icon={<GolLogo className="size-5" />}
            >
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <TokenTile
                  symbol="USDC"
                  detail="95.00"
                  address="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
                />
                <TokenTile symbol="ETH" detail="0.0142" address="eth-native-base" />
                <TokenTile
                  symbol="GHO"
                  detail="0.00"
                  address="0x6Bb7a212910682DCFdbd5BCBb3e28FB4E8da10Ee"
                />
              </div>
            </ToolCard>
          </Section>

          <Section label="get_user_summary">
            <ToolCard
              title="Aave position"
              subtitle="Base"
              icon={<AaveLogo className="size-5 text-primary" />}
            >
              <div className="flex items-end justify-between gap-2">
                <div>
                  <div className="text-[11px] text-muted-foreground">Health factor</div>
                  <div className="text-3xl font-semibold leading-none text-warning">1.10</div>
                </div>
                <Badge variant="warning">At risk</Badge>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Stat label="Collateral" value="$60,714.87" />
                <Stat label="Debt" value="$45,812.13" />
                <Stat label="Available to borrow" value="$2,759.76" />
                <Stat label="Liquidation distance" value="9.1%" tone="warn" />
              </div>
            </ToolCard>
          </Section>

          <Section label="get_markets summary">
            <ToolCard
              title="Aave market state"
              subtitle="Base"
              icon={<AaveLogo className="size-5 text-primary" />}
            >
              <div>
                <div className="text-[11px] text-muted-foreground">Health factor</div>
                <div className="text-2xl font-semibold leading-none text-success">1.85</div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Stat label="Net worth" value="$14,902.74" />
                <Stat label="Available to borrow" value="$8,320.10" />
                <Stat label="Total collateral" value="$60,714.87" />
                <Stat label="Total debt" value="$45,812.13" />
              </div>
            </ToolCard>
          </Section>

          <Section label="get_markets">
            <ToolCard
              title="Aave markets"
              subtitle="Base"
              icon={<AaveLogo className="size-5 text-primary" />}
            >
              <div className="overflow-hidden rounded-xl border border-border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted text-muted-foreground">
                      <th className="px-3 py-2 text-left font-medium">Asset</th>
                      <th className="px-3 py-2 text-right font-medium">Supply</th>
                      <th className="px-3 py-2 text-right font-medium">Borrow</th>
                    </tr>
                  </thead>
                  <tbody>
                    {markets.map((market) => (
                      <tr key={market.symbol} className="border-t border-border">
                        <td className="px-3 py-2 font-medium">{market.symbol}</td>
                        <td className="px-3 py-2 text-right text-success">{market.supply}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground">
                          {market.borrow}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ToolCard>
          </Section>

          <Section label="get_user_summary positions">
            <ToolCard
              title="Your Aave positions"
              subtitle="Base"
              icon={<AaveLogo className="size-5 text-primary" />}
            >
              <div className="space-y-2">
                {[
                  { symbol: 'USDC', label: 'Supplied $1,000.00', tone: 'text-success' },
                  { symbol: 'WETH', label: 'Borrowed $420.15', tone: 'text-warning' },
                  { symbol: 'cbBTC', label: 'Supplied $5,240.00', tone: 'text-success' },
                ].map((position) => (
                  <div
                    key={position.symbol}
                    className="flex items-center justify-between rounded-xl bg-muted px-3 py-2 text-xs"
                  >
                    <span className="font-medium">{position.symbol}</span>
                    <span className={position.tone}>{position.label}</span>
                  </div>
                ))}
              </div>
            </ToolCard>
          </Section>

          <Section label="supply intent">
            <ReviewCard
              title="Supply 100 USDC to Aave"
              description="GOL discovered the market and prepared an unsigned action for owner review."
            />
          </Section>

          <Section label="get_swappable_tokens">
            <ReviewCard
              title="Swap 100 USDC for WETH"
              description="Token availability was discovered through Aave. Final routing and amounts require a fresh simulation."
              protocol="Aave swap discovery"
              status="Unsigned"
            />
          </Section>

          <Section label="get_markets assets">
            <ToolCard title="Supply assets" subtitle="Aave" icon={<AaveLogo className="size-5" />}>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {assets.map((asset) => (
                  <TokenTile key={asset.symbol} {...asset} />
                ))}
              </div>
            </ToolCard>
          </Section>

          <Section label="get_markets reserve">
            <ToolCard title="USDC reserve" subtitle="Aave" icon={<AaveLogo className="size-5" />}>
              <div className="flex items-end gap-8">
                <div>
                  <div className="text-[11px] text-muted-foreground">Supply APY</div>
                  <div className="text-2xl font-semibold leading-none text-success">4.52%</div>
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground">Borrow APY</div>
                  <div className="text-2xl font-semibold leading-none">5.41%</div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Stat label="Max LTV" value="77.00%" />
                <Stat label="Liquidation threshold" value="80.00%" />
                <Stat label="Utilization" value="82.31%" />
                <Stat label="Reserve factor" value="10.00%" />
              </div>
            </ToolCard>
          </Section>

          <Section label="get_markets apy comparison">
            <ToolCard
              title="USDC supply APY"
              subtitle="30 day fixture"
              icon={<AaveLogo className="size-5 text-primary" />}
            >
              <div className="flex items-end gap-8">
                <Stat label="Current" value="4.52%" tone="good" />
                <Stat label="Average" value="4.18%" />
              </div>
              <div className="mt-4 flex h-14 items-end gap-1" aria-label="Fixture APY history">
                {apyBars.map((height, index) => (
                  <span
                    key={`${height}-${index}`}
                    className={`flex-1 rounded-sm bg-success/70 ${height}`}
                  />
                ))}
              </div>
            </ToolCard>
          </Section>

          <Section label="submitInstruction preview">
            <ReviewCard
              title="Pay 40 USDC to Design contractor"
              description="Resolved against mandate 1 on Arc testnet. The immutable recipient and exact integer amount are shown before submission."
              protocol="GOL mandate"
              status="Owner approved"
            />
          </Section>

          <Section label="mandate outcome">
            <ToolCard
              title="Payment refused"
              subtitle="Arc testnet"
              icon={<GolLogo className="size-5" />}
            >
              <div className="rounded-xl bg-warning/10 p-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-warning">
                  <ShieldCheck size={16} /> CUMULATIVE_CAP
                </div>
                <p className="mt-2 text-xs leading-copy text-muted-foreground">
                  The transaction succeeded on-chain and the account contract refused the 70 USDC
                  payment. No value moved.
                </p>
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-success">
                <CheckCircle2 size={15} /> Refusal recorded in the journal
              </div>
            </ToolCard>
          </Section>
        </div>

        <section className="mt-16" aria-labelledby="aave-catalog-title">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="aave-catalog-title" className="text-2xl font-semibold tracking-tight">
                Aave MCP coverage
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-copy text-muted-foreground">
                Catalogue snapshot of every tool discovered from the connected Aave MCP. GOL may
                read, simulate, and prepare unsigned requests; signed relay remains wallet-gated.
              </p>
            </div>
            <Badge variant="default" className="w-fit">
              40 discovered tools
            </Badge>
          </div>
          <div className="space-y-10">
            {aaveToolGroups.map((group) => (
              <section key={group.title} aria-label={group.title}>
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-base font-semibold">{group.title}</h3>
                    <p className="mt-1 max-w-2xl text-xs leading-copy text-muted-foreground">
                      {group.description}
                    </p>
                  </div>
                  <Badge variant="secondary" className="shrink-0">
                    {group.tools.length} tools
                  </Badge>
                </div>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {group.tools.map((tool) => (
                    <AaveCatalogCard key={tool} tool={tool} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </section>

        <section className="mt-16" aria-labelledby="gol-actions-title">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="gol-actions-title" className="text-2xl font-semibold tracking-tight">
                GOL action coverage
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-copy text-muted-foreground">
                Owner actions, restricted-agent execution, indexed reads, and sensitive wallet
                controls each retain their original authority boundary.
              </p>
            </div>
            <Badge variant="default" className="w-fit">
              12 application actions
            </Badge>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {golActions.map((action) => (
              <GolActionCard key={action.name} action={action} />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
