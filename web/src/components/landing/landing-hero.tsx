import Link from 'next/link';
import { ArrowDown, ArrowRight, Check, CircleX, Clock3, ShieldCheck } from 'lucide-react';
import { ClaimLabel } from './landing-primitives';
import { Button } from '@/components/ui/button';
import { landingCopy } from '@/content/landing';
import { MandateGateDemo } from './mandate-gate-demo';

export function LandingHero() {
  return (
    <section
      id="hero"
      className="landing-hero-stage px-5 pt-12 pb-16 sm:px-8 sm:pt-16 lg:pt-20"
      aria-labelledby="landing-title"
    >
      <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-12 lg:gap-8">
        <div
          className="space-y-6 motion-safe:animate-landing-rise lg:col-span-5"
          data-testid="landing-hero-copy"
        >
          <ClaimLabel>{landingCopy.statusLabel}</ClaimLabel>
          <div className="space-y-5">
            <h1
              id="landing-title"
              className="max-w-3xl text-5xl leading-none font-semibold tracking-tighter text-balance sm:text-6xl lg:text-7xl"
            >
              {landingCopy.headline}
            </h1>
            <p className="max-w-xl text-lg leading-snug font-medium text-primary sm:text-xl">
              {landingCopy.refusalLead}
            </p>
          </div>
          <p className="max-w-xl text-base leading-copy text-muted-foreground">
            {landingCopy.authorityLine}
          </p>
          <p className="max-w-xl border-l-2 border-primary pl-4 text-xs leading-copy text-muted-foreground">
            {landingCopy.statusDisclosure}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/app">
                Explore Arc testnet prototype
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="#mandate">
                See the boundary
                <ArrowDown aria-hidden="true" className="size-4" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="motion-safe:animate-landing-rise lg:col-span-7">
          <MandateGateDemo
            headerPolicyIcon={<ShieldCheck aria-hidden="true" className="size-5 text-primary" />}
            gatePolicyIcon={<ShieldCheck aria-hidden="true" className="size-6" />}
            allowedIcon={<Check aria-hidden="true" className="size-5 text-success" />}
            refusedIcon={<CircleX aria-hidden="true" className="size-5 text-destructive" />}
            pendingIcon={<Clock3 aria-hidden="true" className="size-5 text-muted-foreground" />}
            buttonArrowIcon={<ArrowRight aria-hidden="true" className="size-4" />}
            pathArrowIcon={<ArrowRight aria-hidden="true" className="size-5" />}
          />
        </div>
      </div>
    </section>
  );
}
