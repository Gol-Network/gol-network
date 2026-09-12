import { ArrowDown, ArrowRight, CircleDot, Network } from 'lucide-react';
import { authorityStatements, marketCategories } from '@/content/landing';
import { ClaimLabel, PageSection, SectionIntro } from './landing-primitives';

export function MarketVision() {
  return (
    <PageSection id="network" labelledBy="network-title">
      <div className="grid gap-10 lg:grid-cols-12 lg:items-center">
        <div className="lg:col-span-4">
          <SectionIntro
            id="network-title"
            eyebrow="One boundary, many edges"
            title="Markets attach after the mandate."
            copy="Adapters connect execution edges behind the same account policy."
          />
          <p className="mt-6 text-xl font-semibold">{authorityStatements.venue}</p>
          <div className="mt-5">
            <ClaimLabel>Endpoint categories / design target</ClaimLabel>
          </div>
        </div>

        <figure
          data-visual="adapter-network"
          className="market-network rounded-card border border-border bg-muted p-5 sm:p-7 lg:col-span-8"
          aria-label="Proposed GOL adapter topology"
        >
          <div className="grid items-center gap-4 md:grid-cols-[1fr_auto_1fr_auto_2fr]">
            <div className="market-network-account rounded-card border-2 border-primary bg-card p-5 text-center shadow-panel">
              <Network aria-hidden="true" className="mx-auto size-6 text-primary" />
              <p className="mt-3 font-semibold">GOL account</p>
              <p className="font-mono text-xs text-muted-foreground">+ mandate</p>
              <p className="mt-2 text-xs text-muted-foreground">Proposed model</p>
            </div>
            <div aria-hidden="true" className="flex justify-center text-primary max-md:rotate-90">
              <ArrowRight className="size-5 motion-safe:animate-network-pulse" />
            </div>
            <div className="space-y-3">
              <div className="border-l-2 border-primary bg-card px-4 py-3">
                <p className="font-semibold">Adapter A</p>
                <p className="font-mono text-xs text-muted-foreground">bounded route</p>
              </div>
              <div className="border-l-2 border-border bg-card px-4 py-3">
                <p className="font-semibold">Adapter B</p>
                <p className="font-mono text-xs text-muted-foreground">execution edge</p>
              </div>
            </div>
            <div
              aria-hidden="true"
              className="flex justify-center text-muted-foreground max-md:rotate-90"
            >
              <ArrowDown className="size-5 md:-rotate-90" />
            </div>
            <ul className="grid grid-cols-2 gap-2" aria-label="Proposed endpoint categories">
              {marketCategories.map((market) => (
                <li
                  key={market.title}
                  className="flex min-h-11 items-center gap-2 border-b border-border px-2 py-2 text-sm font-medium"
                >
                  <CircleDot aria-hidden="true" className="size-3 shrink-0 text-primary" />
                  {market.title}
                </li>
              ))}
            </ul>
          </div>
        </figure>
      </div>
    </PageSection>
  );
}
