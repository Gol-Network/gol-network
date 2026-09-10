'use client';

import { formatNativeGas, formatUsdc } from '@gol/protocol';
import {
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  LogOut,
  Network,
  Plus,
  Search,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type { PublicConfig } from '@/config';
import { explorerAddressUrl } from '@/config';
import type { AccountSnapshot, AuthState } from '@/client/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface WalletAccountPillProps {
  config: PublicConfig;
  account: AccountSnapshot | null;
  auth: AuthState;
  onExport: (address: string) => void;
}

interface WalletIdentity {
  id: string;
  name: string;
  address: string | null;
  balance: string;
  detail: string;
  exportable?: boolean;
}

function compactAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function avatarUrl(identity: string): string {
  const seed = encodeURIComponent(identity.trim().toLowerCase());
  return `https://api.dicebear.com/10.x/critters/svg?seed=${seed}`;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function WalletAccountPill({ config, account, auth, onExport }: WalletAccountPillProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('accounts');
  const [query, setQuery] = useState('');
  const [golGroupOpen, setGolGroupOpen] = useState(false);
  const [importedGroupOpen, setImportedGroupOpen] = useState(false);
  const [expandedId, setExpandedId] = useState('owner');
  const [balancesVisible, setBalancesVisible] = useState(true);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  const primaryAddress =
    auth.ownerAddress ?? account?.ownerAddress ?? auth.wallets?.[0]?.address ?? null;
  const primaryWallet = auth.wallets?.find(
    (wallet) => wallet.address.toLowerCase() === primaryAddress?.toLowerCase(),
  );
  const activeAccount =
    account && primaryAddress && account.ownerAddress.toLowerCase() === primaryAddress.toLowerCase()
      ? account
      : null;
  const primaryBalance = activeAccount?.balances.ownerUsdcUnits
    ? formatUsdc(BigInt(activeAccount.balances.ownerUsdcUnits))
    : null;

  const walletIdentities = useMemo<WalletIdentity[]>(
    () => [
      {
        id: 'owner',
        name: 'Your wallet',
        address: primaryAddress,
        balance: primaryBalance === null ? 'Loading' : `${primaryBalance} USDC`,
        detail: 'The wallet you sign in with and control',
        exportable: Boolean(
          primaryAddress && auth.exportWallet && (!auth.wallets || primaryWallet?.exportable),
        ),
      },
      {
        id: 'account',
        name: 'Payment funds',
        address: activeAccount?.accountAddress ?? null,
        balance: activeAccount?.accountAddress
          ? `${formatUsdc(BigInt(activeAccount.balances.accountUsdcUnits))} USDC`
          : 'Not configured',
        detail: 'A contract that holds agent payment funds',
      },
      {
        id: 'agent',
        name: 'Payment agent',
        address: activeAccount?.agentAddress ?? null,
        balance: activeAccount?.agentAddress
          ? `${formatNativeGas(BigInt(activeAccount.balances.agentGasWei))} fee balance`
          : 'Not configured',
        detail: 'A restricted signer, not a wallet you log in with',
      },
    ],
    [activeAccount, auth.exportWallet, primaryAddress, primaryBalance, primaryWallet?.exportable],
  );

  const importedWallets = useMemo<WalletIdentity[]>(() => {
    const owner = primaryAddress?.toLowerCase();
    return (auth.wallets ?? [])
      .filter((wallet) => wallet.address.toLowerCase() !== owner)
      .map((wallet, index) => ({
        id: `imported-${wallet.address}-${index}`,
        name: wallet.name,
        address: wallet.address,
        balance: 'Connected',
        detail: wallet.imported
          ? 'Imported Privy wallet'
          : wallet.exportable
            ? 'Privy-managed wallet'
            : 'Linked external wallet',
        exportable: wallet.exportable && Boolean(auth.exportWallet),
      }));
  }, [auth.exportWallet, auth.wallets, primaryAddress]);

  const additionalWalletLabel =
    importedWallets.length === 0 ||
    importedWallets.every((wallet) => wallet.detail.startsWith('Imported'))
      ? `Other imported wallets (${importedWallets.length})`
      : `Other linked wallets (${importedWallets.length})`;

  const normalizedQuery = query.trim().toLowerCase();
  const matches = (identity: WalletIdentity) =>
    !normalizedQuery ||
    identity.name.toLowerCase().includes(normalizedQuery) ||
    identity.address?.toLowerCase().includes(normalizedQuery) ||
    identity.detail.toLowerCase().includes(normalizedQuery);
  const visibleWallets = walletIdentities.filter(matches);
  const visibleOwnerWallet = visibleWallets.filter((identity) => identity.id === 'owner');
  const visibleGolAccounts = visibleWallets.filter((identity) => identity.id !== 'owner');
  const visibleImported = importedWallets.filter(matches);
  const configuredGolAccounts = walletIdentities.filter(
    (identity) => identity.id !== 'owner' && identity.address,
  ).length;

  const networks = useMemo(() => {
    const connectedChainIds = (auth.wallets ?? [])
      .map((wallet) => wallet.chainId)
      .filter((chainId): chainId is number => chainId !== null);
    return Array.from(new Set([config.chainId, ...connectedChainIds])).map((chainId) => ({
      chainId,
      name: chainId === config.chainId ? config.chainName : `Chain ${chainId}`,
      current: chainId === config.chainId,
    }));
  }, [auth.wallets, config.chainId, config.chainName]);
  const visibleNetworks = networks.filter(
    (network) =>
      !normalizedQuery ||
      network.name.toLowerCase().includes(normalizedQuery) ||
      String(network.chainId).includes(normalizedQuery),
  );

  async function copyAddress(address: string) {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedAddress(address);
      window.setTimeout(() => {
        setCopiedAddress((current) => (current === address ? null : current));
      }, 1_200);
    } catch {
      setCopiedAddress(null);
    }
  }

  function updateOpen(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setQuery('');
      setTab('accounts');
    }
  }

  return (
    <Sheet open={open} onOpenChange={updateOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-11 min-w-0 rounded-full bg-card px-1.5 pr-3 shadow-none"
          aria-label="Open wallet"
        >
          <span className="relative shrink-0">
            <Avatar className="size-8 border border-border">
              <AvatarImage src={avatarUrl(primaryAddress ?? 'gol-owner')} alt="" />
              <AvatarFallback>GO</AvatarFallback>
            </Avatar>
            <Badge
              className="absolute -bottom-1 -right-1 grid size-5 place-items-center rounded-full border-2 border-card bg-primary p-1"
              title={config.chainName}
            >
              <img src="/arc-mark.png" alt="" className="size-full object-contain" />
              <span className="sr-only">{config.chainName}</span>
            </Badge>
          </span>
          <span className="hidden max-w-32 truncate font-mono text-[11px] sm:inline">
            {primaryAddress ? compactAddress(primaryAddress) : 'Loading wallet'}
          </span>
          <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden />
        </Button>
      </SheetTrigger>

      <SheetContent
        showClose={false}
        className="inset-y-3 right-3 h-auto max-w-md overflow-visible rounded-card border bg-card p-0 shadow-panel max-sm:left-12 max-sm:right-2 max-sm:w-auto"
      >
        <SheetClose asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="absolute -left-11 top-5 h-12 w-12 justify-center rounded-l-full rounded-r-none border-r-0 bg-card pr-2 shadow-panel hover:bg-card"
            aria-label="Close wallet"
          >
            <ChevronRight className="size-4" aria-hidden />
          </Button>
        </SheetClose>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-card">
          <SheetHeader className="shrink-0 px-5 pb-3 pt-5">
            <SheetTitle className="text-center text-base">Your GOL setup</SheetTitle>
          </SheetHeader>

          <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
            <TabsList className="mx-5 grid shrink-0 grid-cols-2 rounded-full bg-muted p-1">
              <TabsTrigger
                value="accounts"
                className="h-9 rounded-full text-xs font-medium text-muted-foreground data-[state=active]:border data-[state=active]:border-primary/30 data-[state=active]:bg-accent data-[state=active]:text-accent-foreground"
              >
                Addresses
              </TabsTrigger>
              <TabsTrigger
                value="networks"
                className="h-9 rounded-full text-xs font-medium text-muted-foreground data-[state=active]:border data-[state=active]:border-primary/30 data-[state=active]:bg-accent data-[state=active]:text-accent-foreground"
              >
                Networks
              </TabsTrigger>
            </TabsList>

            <div className="relative mx-5 mt-4 shrink-0">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={tab === 'accounts' ? 'Search addresses' : 'Search networks'}
                aria-label={tab === 'accounts' ? 'Search addresses' : 'Search networks'}
                className="h-12 rounded-full bg-muted pl-11"
              />
            </div>

            <TabsContent
              value="accounts"
              className="wallet-scrollbar min-h-0 flex-1 overflow-y-auto py-4"
            >
              <p className="px-5 py-2 text-xs text-muted-foreground">You control</p>
              <div className="mt-1">
                {visibleOwnerWallet.map((identity) => (
                  <IdentityRow
                    key={identity.id}
                    identity={identity}
                    config={config}
                    expanded={expandedId === identity.id}
                    balancesVisible={balancesVisible}
                    copied={copiedAddress === identity.address}
                    onToggle={() =>
                      setExpandedId((current) => (current === identity.id ? '' : identity.id))
                    }
                    onCopy={copyAddress}
                    {...(identity.exportable ? { onExport } : {})}
                  />
                ))}
                {visibleOwnerWallet.length === 0 && (
                  <EmptyResult label="The signed-in wallet does not match your search." />
                )}
              </div>

              <Separator className="my-2" />
              <WalletGroupHeader
                label={`Technical addresses (${configuredGolAccounts}/2 ready)`}
                open={golGroupOpen || Boolean(normalizedQuery)}
                onToggle={() => setGolGroupOpen((current) => !current)}
              />
              {(golGroupOpen || Boolean(normalizedQuery)) && (
                <div className="mt-1">
                  <p className="px-5 pb-2 text-[11px] leading-copy text-muted-foreground">
                    GOL creates these automatically. They are not extra login wallets.
                  </p>
                  {visibleGolAccounts.map((identity) => (
                    <IdentityRow
                      key={identity.id}
                      identity={identity}
                      config={config}
                      expanded={expandedId === identity.id}
                      balancesVisible={balancesVisible}
                      copied={copiedAddress === identity.address}
                      onToggle={() =>
                        setExpandedId((current) => (current === identity.id ? '' : identity.id))
                      }
                      onCopy={copyAddress}
                      {...(identity.exportable ? { onExport } : {})}
                    />
                  ))}
                  {visibleGolAccounts.length === 0 && (
                    <EmptyResult label="No GOL-created account matches your search." />
                  )}
                </div>
              )}

              <Separator className="my-2" />
              <WalletGroupHeader
                label={additionalWalletLabel}
                open={importedGroupOpen}
                onToggle={() => setImportedGroupOpen((current) => !current)}
              />
              {importedGroupOpen && visibleImported.length > 0 && (
                <div className="mt-1">
                  {visibleImported.map((identity) => (
                    <IdentityRow
                      key={identity.id}
                      identity={identity}
                      config={config}
                      expanded={expandedId === identity.id}
                      balancesVisible={balancesVisible}
                      copied={copiedAddress === identity.address}
                      onToggle={() =>
                        setExpandedId((current) => (current === identity.id ? '' : identity.id))
                      }
                      onCopy={copyAddress}
                      {...(identity.exportable ? { onExport } : {})}
                    />
                  ))}
                </div>
              )}
              <Button
                type="button"
                variant="ghost"
                className="mx-3 mt-1 w-[calc(100%-1.5rem)] justify-start rounded-full text-primary"
                onClick={() => auth.linkWallet?.()}
                disabled={!auth.linkWallet}
                title={auth.linkWallet ? 'Link another wallet' : 'Unavailable in fixture mode'}
              >
                <span className="grid size-8 place-items-center rounded-full bg-accent text-accent-foreground">
                  <Plus className="size-4" aria-hidden />
                </span>
                Link another wallet
              </Button>
              {auth.walletActionError ? (
                <p
                  className="mx-5 mt-2 flex items-start gap-2 text-xs text-destructive"
                  role="alert"
                >
                  <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  {auth.walletActionError}
                </p>
              ) : null}

              <Separator className="my-2" />
              <div className="flex items-center justify-between px-5 py-2 text-xs text-muted-foreground">
                <span>Hidden (0)</span>
                <ChevronDown className="size-4" aria-hidden />
              </div>
            </TabsContent>

            <TabsContent
              value="networks"
              className="wallet-scrollbar min-h-0 flex-1 overflow-y-auto px-3 py-4"
            >
              <p className="px-2 pb-3 text-xs text-muted-foreground">
                Networks reported by your connected wallets. GOL actions use the configured chain.
              </p>
              {visibleNetworks.map((network) => (
                <div
                  key={network.chainId}
                  className="flex items-center gap-3 rounded-lg px-3 py-3 hover:bg-muted"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
                    <Network className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-sm font-medium">{network.name}</strong>
                    <span className="block font-mono text-[10px] text-muted-foreground">
                      eip155:{network.chainId}
                    </span>
                  </span>
                  {network.current && <Badge variant="secondary">Current</Badge>}
                </div>
              ))}
              {visibleNetworks.length === 0 && (
                <EmptyResult label="No network matches your search." />
              )}
            </TabsContent>
          </Tabs>

          <div className="shrink-0 border-t border-border p-4">
            <Button
              type="button"
              variant="ghost"
              className="mb-3 w-full rounded-full"
              onClick={() => setBalancesVisible((current) => !current)}
            >
              {balancesVisible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              {balancesVisible ? 'Hide balances' : 'Show balances'}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full rounded-full"
              onClick={() => auth.logout()}
            >
              <LogOut className="size-4" aria-hidden />
              Disconnect
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function WalletGroupHeader({
  label,
  open,
  onToggle,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      className="w-full justify-between rounded-none px-5 text-xs font-normal text-muted-foreground"
      onClick={onToggle}
      aria-expanded={open}
    >
      {label}
      <ChevronDown className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`} />
    </Button>
  );
}

function IdentityRow({
  identity,
  config,
  expanded,
  balancesVisible,
  copied,
  onToggle,
  onCopy,
  onExport,
}: {
  identity: WalletIdentity;
  config: PublicConfig;
  expanded: boolean;
  balancesVisible: boolean;
  copied: boolean;
  onToggle: () => void;
  onCopy: (address: string) => void;
  onExport?: (address: string) => void;
}) {
  return (
    <div className={expanded ? 'bg-muted/70' : undefined}>
      <div className="flex items-center gap-2 px-4 py-2.5">
        <span className="relative shrink-0">
          <Avatar className="size-10 rounded-lg border border-border">
            <AvatarImage src={avatarUrl(identity.address ?? identity.id)} alt="" />
            <AvatarFallback className="rounded-lg">{initials(identity.name)}</AvatarFallback>
          </Avatar>
          <Badge
            className="absolute -bottom-1 -right-1 grid size-5 place-items-center rounded-full border-2 border-card bg-primary p-1"
            title={config.chainName}
          >
            <img src="/arc-mark.png" alt="" className="size-full object-contain" />
            <span className="sr-only">{config.chainName}</span>
          </Badge>
        </span>
        <Button
          type="button"
          variant="ghost"
          className="h-auto min-w-0 flex-1 justify-start rounded-lg px-1 py-1 text-left hover:bg-transparent"
          onClick={onToggle}
          aria-expanded={expanded}
        >
          <span className="min-w-0 flex-1">
            <strong className="block truncate text-sm font-medium text-foreground">
              {identity.name}
            </strong>
            <span className="mt-1 flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
              <ChevronDown
                className={`size-3 transition-transform ${expanded ? 'rotate-180' : ''}`}
                aria-hidden
              />
              {identity.address ? compactAddress(identity.address) : identity.detail}
            </span>
          </span>
        </Button>
        <span className="shrink-0 text-right font-mono text-[11px] text-foreground">
          {balancesVisible ? identity.balance : '••••'}
        </span>
      </div>

      {expanded && (
        <div className="space-y-2 px-5 pb-3 pl-16">
          <p className="text-xs text-muted-foreground">{identity.detail}</p>
          {identity.address && (
            <div className="flex items-center gap-1">
              <span className="mr-auto truncate font-mono text-[10px] text-muted-foreground">
                {config.chainName}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 rounded-full"
                onClick={() => void onCopy(identity.address!)}
                aria-label={`Copy ${identity.name} address`}
                title={copied ? 'Copied' : 'Copy address'}
              >
                {copied ? (
                  <Check className="size-3.5 text-success" />
                ) : (
                  <Copy className="size-3.5" />
                )}
              </Button>
              <Button
                asChild
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 rounded-full"
              >
                <a
                  href={explorerAddressUrl(config, identity.address)}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open ${identity.name} in explorer`}
                >
                  <ExternalLink className="size-3.5" />
                </a>
              </Button>
              {identity.exportable && onExport && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="rounded-full"
                  onClick={() => void onExport(identity.address!)}
                >
                  Export
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EmptyResult({ label }: { label: string }) {
  return <p className="px-5 py-8 text-center text-xs text-muted-foreground">{label}</p>;
}
