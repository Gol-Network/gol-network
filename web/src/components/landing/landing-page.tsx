import { EnforcementLayers } from './enforcement-layers';
import { LandingFooter } from './landing-footer';
import { LandingHeader } from './landing-header';
import { LandingHero } from './landing-hero';
import { MarketVision } from './market-vision';
import { MandateBento } from './policy-gate';
import { ProductStatus } from './product-status';
import { ReceiptModel } from './receipt-model';

export function LandingPage() {
  return (
    <div className="min-h-screen overflow-x-clip bg-background text-foreground">
      <LandingHeader />
      <main id="main-content" tabIndex={-1} className="outline-none">
        <LandingHero />
        <EnforcementLayers />
        <MandateBento />
        <ReceiptModel />
        <MarketVision />
        <ProductStatus />
      </main>
      <LandingFooter />
    </div>
  );
}
