import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Disclosure({
  summary,
  children,
  className,
}: {
  summary: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <details className={cn('group border-t border-border', className)}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-sm py-3 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        {summary}
        <ChevronDown
          aria-hidden="true"
          className="size-4 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none"
        />
      </summary>
      <div className="pb-4 text-sm leading-copy text-muted-foreground">{children}</div>
    </details>
  );
}
