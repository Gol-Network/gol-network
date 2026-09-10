import { cn } from '@/lib/utils';

export function GolLogo({ className }: { className?: string | undefined }) {
  return <img src="/gol-mark-blue.svg" alt="" className={cn('object-contain', className)} />;
}
