# Screenshot status

The PNG files in this directory are reproducible captures of the actual Next.js application in its clearly labeled fixture mode. They follow the mocked provider walkthrough through the owner setup checklist, a 40 USDC execution, a 70 USDC on-chain refusal, and a cited grounded answer. The final refusal state is captured in both light and dark themes. Every capture carries the persistent `FIXTURE MODE` banner. They are not evidence of a live Arc, Privy, or The Graph integration.

Regenerate them with:

```bash
GOL_CAPTURE_SCREENSHOTS=1 pnpm --filter @gol/web test:e2e -- capture.spec.ts
```

Before submission, add or replace these with clean-browser captures from the deployed interactive application and retain the transaction references used in the recording.
