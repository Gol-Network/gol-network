import Link from 'next/link';
import { GolLogo } from '@/components/ui/gol-logo';
import { landingNavItems } from '@/content/landing';

export function LandingFooter() {
  return (
    <footer className="border-t border-border bg-foreground px-5 py-16 text-background sm:px-8 sm:py-20">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/"
            className="flex min-h-11 w-fit items-center gap-3 rounded-md font-semibold outline-none focus-visible:ring-2 focus-visible:ring-background"
            aria-label="Gol home"
          >
            <GolLogo className="size-7" />
            GOL
          </Link>
          <nav className="flex flex-wrap gap-x-5 gap-y-1 text-sm" aria-label="Footer">
            {landingNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="inline-flex min-h-11 items-center rounded-sm text-background/70 outline-none transition-colors hover:text-background focus-visible:ring-2 focus-visible:ring-background motion-reduce:transition-none"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/tools"
              className="inline-flex min-h-11 items-center rounded-sm text-background/70 outline-none transition-colors hover:text-background focus-visible:ring-2 focus-visible:ring-background motion-reduce:transition-none"
            >
              Tools
            </Link>
            <Link
              href="/app"
              className="inline-flex min-h-11 items-center rounded-sm text-background/70 outline-none transition-colors hover:text-background focus-visible:ring-2 focus-visible:ring-background motion-reduce:transition-none"
            >
              Arc testnet
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
