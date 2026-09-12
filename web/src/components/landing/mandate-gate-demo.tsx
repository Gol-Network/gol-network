'use client';

import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { illustrativeRequests } from '@/content/landing';
import { cn } from '@/lib/utils';

type RequestId = (typeof illustrativeRequests)[number]['id'];

export function MandateGateDemo({
  headerPolicyIcon,
  gatePolicyIcon,
  allowedIcon,
  refusedIcon,
  pendingIcon,
  buttonArrowIcon,
  pathArrowIcon,
}: {
  headerPolicyIcon: ReactNode;
  gatePolicyIcon: ReactNode;
  allowedIcon: ReactNode;
  refusedIcon: ReactNode;
  pendingIcon: ReactNode;
  buttonArrowIcon: ReactNode;
  pathArrowIcon: ReactNode;
}) {
  const [selected, setSelected] = useState<RequestId>('over-limit');
  const [resolved, setResolved] = useState<RequestId>('over-limit');
  const [running, setRunning] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const timer = useRef<number | null>(null);
  const request = illustrativeRequests.find((item) => item.id === resolved)!;

  useEffect(() => {
    setMounted(true);
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);

  function runCheck() {
    setRunning(true);
    setAnnouncement('');
    const delay = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 520;
    timer.current = window.setTimeout(() => {
      setResolved(selected);
      setRunning(false);
      const next = illustrativeRequests.find((item) => item.id === selected)!;
      setAnnouncement(
        next.outcome === 'allowed'
          ? 'Allowed within illustrative $100 limit'
          : 'Refused: PER_TX_CAP; $100 headroom',
      );
      timer.current = null;
    }, delay);
  }

  const refused = request.outcome === 'refused';

  return (
    <figure
      className="consequence-panel overflow-hidden rounded-card border border-border bg-card shadow-panel"
      aria-labelledby="gate-demo-title"
      data-visual="mandate-gate"
      data-state={running ? 'checking' : request.outcome}
      data-testid="mandate-gate-demo"
    >
      <figcaption className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted px-5 py-4">
        <div className="flex items-center gap-3">
          {headerPolicyIcon}
          <div>
            <p className="font-mono text-xs font-semibold tracking-wide text-primary uppercase">
              Illustrative policy request
            </p>
            <h2 id="gate-demo-title" className="font-semibold">
              The consequence line
            </h2>
          </div>
        </div>
        <span className="font-mono text-xs text-muted-foreground">Fixed sample / no network</span>
      </figcaption>

      <div className="p-5 sm:p-7">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <fieldset>
            <legend className="mb-2 font-mono text-xs font-medium text-muted-foreground uppercase">
              Agent asks
            </legend>
            <div className="flex gap-2">
              {illustrativeRequests.map((item) => (
                <Button
                  key={item.id}
                  type="button"
                  variant={selected === item.id ? 'default' : 'outline'}
                  className="min-h-11 min-w-20"
                  aria-pressed={selected === item.id}
                  disabled={!mounted || running}
                  onClick={() => setSelected(item.id)}
                >
                  ${item.amountUsd}
                </Button>
              ))}
            </div>
          </fieldset>
          <Button
            type="button"
            variant="secondary"
            className="min-h-11"
            disabled={!mounted || running}
            onClick={runCheck}
          >
            {running ? 'Checking…' : 'Run illustrative check'}
            {buttonArrowIcon}
          </Button>
        </div>

        <ol
          className="consequence-path mt-7 grid gap-3 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-center"
          aria-label="Agent request passes through account policy before execution"
        >
          <li className="rounded-lg border border-border bg-background p-4">
            <p className="font-mono text-xs text-muted-foreground uppercase">Agent request</p>
            <p className="mt-2 text-3xl font-semibold">
              ${running ? (selected === 'over-limit' ? 101 : 100) : request.amountUsd}
            </p>
          </li>
          <li aria-hidden="true" className="flex justify-center text-primary max-sm:rotate-90">
            <span className={cn(running && 'motion-safe:animate-consequence-travel')}>
              {pathArrowIcon}
            </span>
          </li>
          <li className="rounded-card border-2 border-primary bg-accent p-5 text-center">
            <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
              {gatePolicyIcon}
            </span>
            <p className="mt-3 font-semibold">Account policy</p>
            <p className="font-mono text-xs text-muted-foreground">$100 mandate</p>
          </li>
          <li aria-hidden="true" className="flex justify-center text-primary max-sm:rotate-90">
            {pathArrowIcon}
          </li>
          <li
            className={cn(
              'rounded-lg border bg-background p-4 transition-colors',
              running ? 'border-border' : refused ? 'border-destructive' : 'border-success',
            )}
          >
            {running ? (
              <>
                <div className="flex items-center gap-2">
                  {pendingIcon}
                  <p className="font-semibold">Checking mandate…</p>
                </div>
                <p className="mt-2 font-mono text-xs text-muted-foreground">
                  Fixed illustrative lookup
                </p>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  {refused ? refusedIcon : allowedIcon}
                  <p className={cn('font-semibold', refused ? 'text-destructive' : 'text-success')}>
                    {refused ? 'Refused: PER_TX_CAP' : 'Allowed'}
                  </p>
                </div>
                <p className="mt-2 font-mono text-xs text-muted-foreground">
                  {refused ? 'Headroom recorded: $100' : 'Within the illustrative limit'}
                </p>
              </>
            )}
          </li>
        </ol>
        <p className="sr-only" aria-live="polite">
          {announcement}
        </p>
      </div>
    </figure>
  );
}
