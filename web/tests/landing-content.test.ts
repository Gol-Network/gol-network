import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  authorityStatements,
  designTargetLabel,
  designTargets,
  enforcementLayers,
  illustrativeRequests,
  landingCopy,
  mandateControlGroups,
  marketCategories,
  prototypeToday,
  receiptModels,
} from '@/content/landing';
import { publicOrigin } from '@/content/site';

describe('landing content boundaries', () => {
  it('keeps the concise promise and current-state disclosure explicit', () => {
    expect(landingCopy.headline).toBe('Agents can act. Your limit still decides.');
    expect(landingCopy.headline.split(/\s+/)).toHaveLength(7);
    expect(landingCopy.refusalLead).toContain('$101 request');
    expect(landingCopy.shutdownInvariant).toContain('still refused by the account check');
    expect(landingCopy.statusDisclosure).toContain('complete Gol product has not shipped');
    expect(landingCopy.statusDisclosure).toContain('Arc testnet');
  });

  it('uses two fixed presentation fixtures rather than a browser policy evaluator', () => {
    expect(illustrativeRequests).toEqual([
      {
        id: 'within-limit',
        amountUsd: 100,
        limitUsd: 100,
        outcome: 'allowed',
        rule: 'PER_TX_CAP',
        headroomUsd: 0,
      },
      {
        id: 'over-limit',
        amountUsd: 101,
        limitUsd: 100,
        outcome: 'refused',
        rule: 'PER_TX_CAP',
        headroomUsd: 100,
      },
    ]);
  });

  it('keeps mandate roles and trust statements exact', () => {
    expect(authorityStatements.ownerLane).toContain('fail-open');
    expect(authorityStatements.agentLane).toContain('fail-closed');
    expect(authorityStatements.permission).toBe(
      'A signer may refuse. Only account policy may permit an agent payment.',
    );
    expect(authorityStatements.growth).toContain('cannot write mandate state');
    expect(authorityStatements.venue).toBe('GOL is not the venue.');
    expect(enforcementLayers.map((item) => item.title)).toEqual([
      'Prompt',
      'Framework',
      'Server',
      'Account policy',
    ]);
  });

  it('marks broad mandate, receipt, and market capabilities as design targets', () => {
    const claims = [...mandateControlGroups, ...receiptModels, ...marketCategories];
    expect(claims.every((claim) => claim.claimState === designTargetLabel)).toBe(true);
    expect(marketCategories).toHaveLength(8);
    expect(mandateControlGroups.map((group) => group.title)).toEqual([
      'Amount',
      'Destination',
      'Execution',
      'Lifecycle',
    ]);
  });

  it('keeps pending release evidence out of the prototype-today column', () => {
    expect(designTargets).toContain(
      'Mandatory real-user browser acceptance under the current KMS-backed agent signer.',
    );
    expect(designTargets).toContain(
      'Production readiness, an independent security audit, and universal venue support.',
    );
    expect(prototypeToday.join(' ')).not.toMatch(/production|security audit/i);
  });

  it('uses the dated production origin without importing product runtime configuration', () => {
    expect(publicOrigin).toBe('https://gol.network');
    const metadataSources = ['app/layout.tsx', 'app/robots.ts', 'app/sitemap.ts']
      .map((file) => readFileSync(join(process.cwd(), file), 'utf8'))
      .join('\n');
    expect(metadataSources).not.toContain('https://gol.network');
    expect(metadataSources).not.toMatch(/process\.env|@\/server|publicConfigResult/);
  });

  it('keeps prohibited marketing claims out of rendered content', () => {
    const renderedContent = JSON.stringify({
      authorityStatements,
      landingCopy,
      mandateControlGroups,
      marketCategories,
      receiptModels,
    });
    const prohibited = [
      /production[- ]ready/i,
      /fully live/i,
      /live multi-market/i,
      /best price/i,
      /only platform/i,
      /guaranteed yield/i,
      /partnered with/i,
      /token (?:sale|launch)/i,
      /coming (?:soon|on)/i,
    ];
    for (const pattern of prohibited) expect(renderedContent).not.toMatch(pattern);
  });

  it('keeps server, wallet, and product runtime modules out of the landing import graph', () => {
    const componentDirectory = join(process.cwd(), 'src/components/landing');
    const sources = [
      readFileSync(join(process.cwd(), 'app/page.tsx'), 'utf8'),
      ...readdirSync(componentDirectory)
        .filter((file) => file.endsWith('.tsx'))
        .map((file) => readFileSync(join(componentDirectory, file), 'utf8')),
    ].join('\n');
    expect(sources).not.toMatch(/@\/server|@\/client|@\/wallet/);
    expect(sources).not.toMatch(
      /@privy|\bviem\b|@gol\/agent|@gol\/protocol|@react-three|\bthree\b|framer-motion/,
    );
    expect(sources.match(/['\"]use client['\"]/g)).toHaveLength(1);
    expect(sources).not.toMatch(/fetch\(|XMLHttpRequest|WebSocket/);
    expect(sources).not.toMatch(/[·—]/);
  });
});
