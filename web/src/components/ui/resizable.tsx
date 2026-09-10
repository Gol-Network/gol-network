'use client';

import * as React from 'react';
import {
  Group,
  Panel,
  Separator,
  type GroupProps,
  type SeparatorProps,
} from 'react-resizable-panels';
import { cn } from '@/lib/utils';

function ResizablePanelGroup({ className, ...props }: GroupProps) {
  return <Group className={cn('flex h-full w-full', className)} {...props} />;
}

const ResizablePanel = Panel;

function ResizableHandle({
  className,
  withHandle = false,
  ...props
}: SeparatorProps & { withHandle?: boolean }) {
  return (
    <Separator
      className={cn(
        'group relative flex w-4 shrink-0 items-center justify-center bg-transparent outline-none',
        className,
      )}
      {...props}
    >
      {withHandle ? (
        <span
          className="h-16 w-1.5 rounded-full bg-foreground/60 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 group-data-[separator=active]:opacity-100"
          aria-hidden="true"
        />
      ) : null}
    </Separator>
  );
}

export { ResizableHandle, ResizablePanel, ResizablePanelGroup };
