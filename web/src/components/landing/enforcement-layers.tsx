import { CircleSlash2, LockKeyhole } from 'lucide-react';
import { enforcementLayers, landingCopy } from '@/content/landing';
import { PageSection } from './landing-primitives';

export function EnforcementLayers() {
  return (
    <PageSection
      id="enforcement"
      className="border-y border-border bg-foreground py-14 text-background lg:py-16"
      labelledBy="enforcement-title"
    >
      <div className="grid gap-8 lg:grid-cols-12 lg:items-center">
        <div className="lg:col-span-4">
          <p className="font-mono text-xs font-semibold tracking-widest text-background/60 uppercase">
            Where the rule survives
          </p>
          <h2 id="enforcement-title" className="mt-3 text-3xl leading-tight font-semibold">
            Only one line reaches execution.
          </h2>
        </div>
        <ol
          data-visual="enforcement-rail"
          className="grid gap-4 sm:grid-cols-2 lg:col-span-8 lg:grid-cols-4"
        >
          {enforcementLayers.map((layer, index) => {
            const binding = index === enforcementLayers.length - 1;
            return (
              <li key={layer.title} className="min-w-0">
                <div className="flex items-center gap-2">
                  {binding ? (
                    <LockKeyhole aria-hidden="true" className="size-4 text-primary" />
                  ) : (
                    <CircleSlash2 aria-hidden="true" className="size-4 text-background/50" />
                  )}
                  <span className="font-semibold">{layer.title}</span>
                </div>
                <div className="mt-3 flex items-center gap-2" aria-hidden="true">
                  <span
                    className={
                      binding
                        ? 'h-0.5 flex-1 bg-primary motion-safe:animate-rail-resolve'
                        : 'h-0.5 w-1/2 bg-background/30'
                    }
                  />
                  <span className="size-1.5 rounded-full bg-background/40" />
                </div>
                <p className="mt-2 font-mono text-xs text-background/60">{layer.detail}</p>
                <span className="sr-only">{layer.verdict}</span>
              </li>
            );
          })}
        </ol>
      </div>
      <p className="mt-8 border-t border-background/20 pt-5 text-sm leading-copy text-background/70">
        {landingCopy.shutdownInvariant}
      </p>
    </PageSection>
  );
}
