# Screenshot status

The PNG files in this directory are reproducible captures of the actual Next.js application in its clearly labeled local preview mode. They demonstrate layout, filtering, and explanation states with deterministic fixture records. They are not evidence of a live Arc, Privy, or The Graph integration.

Regenerate them with:

```bash
GOL_CAPTURE_SCREENSHOTS=1 pnpm --filter @gol/web test:e2e -- capture.spec.ts
```

Before submission, add or replace these with three clean-browser captures from the deployed interactive application and retain the transaction references used in the recording.
