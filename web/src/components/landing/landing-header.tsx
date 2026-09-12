import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GolLogo } from '@/components/ui/gol-logo';
import { landingNavItems } from '@/content/landing';

export function LandingHeader() {
  return (
    <>
      <a
        href="#main-content"
        className="sr-only fixed top-3 left-3 z-50 rounded-md bg-foreground px-4 py-3 text-sm font-semibold text-background outline-none focus:not-sr-only focus:ring-2 focus:ring-ring"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-border bg-background/95">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-5 sm:px-8">
          <Link
            href="/"
            className="flex min-h-11 items-center gap-3 rounded-md font-semibold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Gol home"
          >
            <GolLogo className="size-7" />
            <span>GOL</span>
          </Link>
          <nav className="mx-auto hidden items-center gap-6 lg:flex" aria-label="Landing page">
            {landingNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-sm py-3 text-sm font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <Button asChild size="sm" className="ml-auto min-h-11 lg:ml-0">
            <Link href="/app">
              <span className="sm:hidden">Open Arc testnet</span>
              <span className="hidden sm:inline">Explore Arc testnet</span>
              <ArrowUpRight aria-hidden="true" className="size-4" />
            </Link>
          </Button>
        </div>
      </header>
    </>
  );
}
