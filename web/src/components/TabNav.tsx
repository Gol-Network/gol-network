'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/', label: 'Arc testnet', match: (path: string) => path === '/' },
  {
    href: '/tokenized-stocks',
    label: 'Tokenized stocks',
    match: (path: string) => path.startsWith('/tokenized-stocks'),
  },
];

/**
 * Product-level tab strip above each experience. The Arc testnet tab is the live owner workflow;
 * the Tokenized stocks tab is an explicitly labeled Base hackathon mock.
 */
export function TabNav() {
  const pathname = usePathname() ?? '/';
  return (
    <nav className="app-tabs" aria-label="Primary">
      <div className="app-tabs-inner">
        <span className="app-tabs-brand">GOL</span>
        <div className="app-tabs-list">
          {TABS.map((tab) => {
            const selected = tab.match(pathname);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={selected ? 'app-tab selected' : 'app-tab'}
                aria-current={selected ? 'page' : undefined}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
        <span className="app-tabs-tag">HACKATHON BUILD</span>
      </div>
    </nav>
  );
}
