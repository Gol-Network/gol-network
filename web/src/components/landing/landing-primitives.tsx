import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function ClaimLabel({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex w-fit rounded-full border border-border bg-muted px-3 py-1 font-mono text-xs font-semibold tracking-wide text-muted-foreground uppercase">
      {children}
    </span>
  );
}

export function SectionIntro({
  eyebrow,
  title,
  copy,
  className,
  id,
}: {
  eyebrow: string;
  title: string;
  copy: string;
  className?: string;
  id?: string;
}) {
  return (
    <div className={cn('max-w-3xl space-y-5', className)}>
      <p className="font-mono text-xs font-semibold tracking-widest text-primary uppercase">
        {eyebrow}
      </p>
      <h2
        id={id}
        className="text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-5xl"
      >
        {title}
      </h2>
      <p className="max-w-2xl text-base leading-copy text-muted-foreground sm:text-lg">{copy}</p>
    </div>
  );
}

export function PageSection({
  children,
  className,
  id,
  labelledBy,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  labelledBy?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={cn('px-5 py-16 sm:px-8 lg:py-20', className)}
    >
      <div className="mx-auto max-w-7xl">{children}</div>
    </section>
  );
}
