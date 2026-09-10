import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  // The fixture exercises a WebGL background and several timed state machines. Serial browser
  // execution keeps those deterministic on developer laptops and small CI runners.
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:3100', trace: 'retain-on-failure' },
  webServer: [
    {
      command:
        'cd ../langgraph-agent && uv run uvicorn gol_agent.app:app --host 127.0.0.1 --port 8124',
      url: 'http://127.0.0.1:8124/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command:
        'GOL_FIXTURE_MODE=true PRIVY_APP_ID= FACTORY_ADDRESS= AGENT_GAS_MANAGED=false NEXT_DIST_DIR=.next-e2e pnpm build && GOL_FIXTURE_MODE=true PRIVY_APP_ID= FACTORY_ADDRESS= AGENT_GAS_MANAGED=false NEXT_DIST_DIR=.next-e2e pnpm start --hostname 127.0.0.1 --port 3100',
      url: 'http://127.0.0.1:3100',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
