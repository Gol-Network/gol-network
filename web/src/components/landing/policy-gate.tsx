import { Bot, Clock3, Crosshair, Route, ShieldCheck, UserRound } from 'lucide-react';
import { authorityStatements, mandateControlGroups } from '@/content/landing';
import { ClaimLabel, PageSection, SectionIntro } from './landing-primitives';

const controlIcons = [Crosshair, Route, ShieldCheck, Clock3] as const;

export function MandateBento() {
  return (
    <PageSection id="mandate" labelledBy="mandate-title">
      <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
        <SectionIntro
          id="mandate-title"
          eyebrow="Make the line yours"
          title="Set the edges. Leave the strategy open."
          copy="Amount, destination, execution and lifecycle bounds define what an agent may ask for."
          className="lg:col-span-8"
        />
        <div className="lg:col-span-4 lg:justify-self-end">
          <ClaimLabel>Proposed mandate model</ClaimLabel>
        </div>
      </div>

      <div data-visual="mandate-bento" className="mt-10 grid gap-3 lg:grid-cols-12">
        <div className="grid gap-3 sm:grid-cols-2 lg:col-span-12">
          <div className="flex items-center gap-3 border-l-2 border-foreground bg-muted px-4 py-3">
            <UserRound aria-hidden="true" className="size-5" />
            <p className="text-sm font-medium">{authorityStatements.ownerLane}</p>
          </div>
          <div className="flex items-center gap-3 border-l-2 border-primary bg-accent px-4 py-3">
            <Bot aria-hidden="true" className="size-5 text-primary" />
            <p className="text-sm font-medium">{authorityStatements.agentLane}</p>
          </div>
        </div>

        {mandateControlGroups.map((group, index) => {
          const Icon = controlIcons[index] ?? ShieldCheck;
          const amount = group.title === 'Amount';
          return (
            <article
              key={group.title}
              data-visual={`mandate-${group.title.toLowerCase()}`}
              className={
                amount
                  ? 'rounded-card border border-primary bg-accent p-6 shadow-panel lg:col-span-7 lg:row-span-3 sm:p-8'
                  : 'rounded-card border border-border bg-card p-6 lg:col-span-5'
              }
            >
              <div className="flex items-center justify-between gap-3">
                <h3
                  className={
                    amount ? 'text-2xl font-semibold sm:text-3xl' : 'text-lg font-semibold'
                  }
                >
                  {group.title}
                </h3>
                <Icon aria-hidden="true" className="size-5 text-primary" />
              </div>
              {amount ? (
                <div className="mt-8">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="font-mono text-xs text-muted-foreground uppercase">
                        Per transaction
                      </p>
                      <p className="mt-1 text-5xl font-semibold tracking-tight">$100</p>
                    </div>
                    <p className="font-mono text-sm font-semibold text-destructive">$101 outside</p>
                  </div>
                  <div
                    className="mandate-limit-track mt-5 h-2 rounded-full bg-border"
                    aria-hidden="true"
                  >
                    <div className="mandate-limit-fill h-full w-4/5 rounded-full bg-primary" />
                    <span className="mandate-limit-breach" />
                  </div>
                  <ul className="mt-7 grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
                    {group.items.slice(1).map((item) => (
                      <li key={item} className="border-t border-border pt-3">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <ul className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm text-muted-foreground">
                  {group.items.map((item) => (
                    <li key={item} className="border-t border-border pt-3">
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </article>
          );
        })}
      </div>
      <p className="mt-6 max-w-4xl text-sm leading-copy text-muted-foreground">
        {authorityStatements.permission} {authorityStatements.growth}
      </p>
    </PageSection>
  );
}
