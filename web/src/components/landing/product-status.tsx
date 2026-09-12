import Link from 'next/link';
import { ArrowRight, Check, Clock3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Disclosure } from '@/components/ui/disclosure';
import { designTargets, landingCopy, prototypeToday } from '@/content/landing';
import { PageSection } from './landing-primitives';

export function ProductStatus() {
  return (
    <PageSection id="status" labelledBy="status-title" className="bg-foreground text-background">
      <div className="grid gap-10 lg:grid-cols-12 lg:items-center">
        <div className="lg:col-span-7">
          <p className="font-mono text-xs font-semibold tracking-widest text-background/60 uppercase">
            Know what exists
          </p>
          <h2 id="status-title" className="mt-3 text-3xl leading-tight font-semibold sm:text-5xl">
            What works today. What comes next.
          </h2>
          <div data-visual="status-ledger" className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="border-l-2 border-primary pl-4">
              <div className="flex items-center gap-2">
                <Check aria-hidden="true" className="size-5 text-primary" />
                <h3 className="font-semibold">Today on Arc testnet</h3>
              </div>
              <p className="mt-3 text-sm leading-copy text-background/70">
                Owner setup, a mandate-oriented payment flow, separate agent signing and an
                implemented payment-rule check.
              </p>
            </div>
            <div className="border-l-2 border-background/30 pl-4">
              <div className="flex items-center gap-2">
                <Clock3 aria-hidden="true" className="size-5 text-background/60" />
                <h3 className="font-semibold">Broader GOL design target</h3>
              </div>
              <p className="mt-3 text-sm leading-copy text-background/70">
                The multi-market, multi-chain account and adapter model has not shipped.
              </p>
            </div>
          </div>
          <div className="mt-7 border-y border-background/20">
            <Disclosure
              summary="Complete status and evidence boundaries"
              className="border-background/20"
            >
              <div className="grid gap-6 text-background/70 sm:grid-cols-2">
                <div>
                  <p className="font-semibold text-background">Repository-supported prototype</p>
                  <ul className="mt-2 list-disc space-y-2 pl-5">
                    {prototypeToday.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="font-semibold text-background">Not established</p>
                  <ul className="mt-2 list-disc space-y-2 pl-5">
                    {designTargets.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </Disclosure>
          </div>
        </div>

        <div className="border-t border-background/20 pt-8 lg:col-span-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-10">
          <p className="text-4xl leading-none font-semibold tracking-tight text-balance sm:text-5xl">
            {landingCopy.closer}
          </p>
          <Button asChild size="lg" variant="secondary" className="mt-8 min-h-11">
            <Link href="/app">
              Explore Arc testnet prototype
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </Button>
          <p className="mt-4 text-xs text-background/60">
            Mandatory real-user browser acceptance under the current KMS-backed signer remains
            pending.
          </p>
        </div>
      </div>
    </PageSection>
  );
}
