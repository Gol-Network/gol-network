'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/app', label: 'Arc testnet', match: (path: string) => path === '/app' },
  {
    href: '/tokenized-stocks',
    label: 'Tokenized stocks',
    match: (path: string) => path.startsWith('/tokenized-stocks'),
  },
];

/**
 * Product-level tab strip above each experience. The Arc testnet tab is the owner workflow;
 * the Tokenized stocks tab is an explicitly labeled Base hackathon mock.
 */
export function TabNav() {
  const pathname = usePathname() ?? '/';
  return (
    <nav
      className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-sm"
      aria-label="Prototype experiences"
    >
      <div className="mx-auto flex h-12 max-w-[1440px] items-center gap-5 px-5 sm:px-8 lg:px-[54px]">
        <span className="text-xs font-extrabold tracking-[0.14em]">GOL</span>
        <div className="flex gap-1">
          {TABS.map((tab) => {
            const selected = tab.match(pathname);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`rounded-full px-3 py-2 font-mono text-[10px] font-bold tracking-[0.1em] uppercase transition-colors ${
                  selected
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                aria-current={selected ? 'page' : undefined}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
        <span className="ml-auto hidden font-mono text-[9px] tracking-[0.16em] text-primary sm:inline">
          PROTOTYPE
        </span>
      </div>
    </nav>
  );
}
