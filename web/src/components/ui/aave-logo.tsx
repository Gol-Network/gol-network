import { TokenIcon } from '@/components/ui/token-icon';

const AAVE_BASE = '0x63706e401c06ac8513145b7687A14804d17f814b';

export function AaveLogo({ className }: { className?: string }) {
  return <TokenIcon address={AAVE_BASE} symbol="AAVE" alt="Aave protocol" className={className} />;
}
