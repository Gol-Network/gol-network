import { Check, CircleX, FileClock } from 'lucide-react';
import { landingCopy, receiptModels } from '@/content/landing';
import { ClaimLabel, PageSection, SectionIntro } from './landing-primitives';

const receiptIcons = [FileClock, Check, CircleX] as const;

export function ReceiptModel() {
  return (
    <PageSection
      id="receipts"
      labelledBy="receipts-title"
      className="border-y border-border bg-muted"
    >
      <div className="grid gap-10 lg:grid-cols-12 lg:items-center">
        <div className="lg:col-span-4">
          <SectionIntro
            id="receipts-title"
            eyebrow="Keep the proof"
            title="The stop becomes part of the record."
            copy={landingCopy.consumerLine}
          />
          <div className="mt-6">
            <ClaimLabel>Design target / illustrative values</ClaimLabel>
          </div>
        </div>
        <ol
          data-visual="receipt-stack"
          className="grid gap-3 lg:col-span-8 lg:grid-cols-3 lg:items-start"
          aria-label="Outcome record stack"
        >
          {receiptModels.map((receipt, index) => {
            const Icon = receiptIcons[index] ?? FileClock;
            const refused = receipt.title === 'Refused';
            return (
              <li
                key={receipt.title}
                data-receipt={receipt.title.toLowerCase()}
                className={
                  index === 0
                    ? 'receipt-stack-item lg:translate-y-8 lg:-rotate-2'
                    : index === 1
                      ? 'receipt-stack-item lg:translate-y-4 lg:-rotate-1'
                      : 'receipt-stack-item relative z-10'
                }
              >
                <article
                  className={
                    refused
                      ? 'rounded-card border border-destructive bg-card p-5 shadow-panel'
                      : 'rounded-card border border-border bg-card p-5'
                  }
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Icon
                        aria-hidden="true"
                        className={refused ? 'size-5 text-destructive' : 'size-5 text-primary'}
                      />
                      <h3 className="text-xl font-semibold">{receipt.title}</h3>
                    </div>
                    <span className="font-mono text-xs text-muted-foreground">0{index + 1}</span>
                  </div>
                  <dl className="mt-5 divide-y divide-border border-y border-border">
                    {receipt.fields.map(([label, value]) => (
                      <div key={label} className="flex items-center justify-between gap-3 py-3">
                        <dt className="font-mono text-xs text-muted-foreground">{label}</dt>
                        <dd className="text-right font-mono text-xs font-semibold">{value}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="mt-4 text-xs leading-copy text-muted-foreground">
                    {receipt.detail}
                  </p>
                </article>
              </li>
            );
          })}
        </ol>
      </div>
    </PageSection>
  );
}
