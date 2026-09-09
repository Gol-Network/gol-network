/**
 * Subgraph preparation.
 *
 * Rewrites the factory address and start block in `subgraph/subgraph.yaml` from verified
 * deployment metadata, or from explicit command arguments. It refuses to prepare a manifest from
 * a deployment that is not recorded as deployed, so the placeholder address can never be shipped.
 *
 * No deploy key or query key is read or written here.
 *
 * Run: pnpm subgraph:prepare [-- --manifest <path>] [--factory 0x… --start-block <number>]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const repoRoot = new URL('../', import.meta.url);
const manifestPath = fileURLToPath(new URL('subgraph/subgraph.yaml', repoRoot));

const args = parseArgs(process.argv.slice(2));
const deploymentPath = fileURLToPath(
  new URL(args.manifest ?? 'deployments/arc-testnet.json', repoRoot),
);

const { factory, startBlock, source } = resolveDeployment();
writeFileSync(manifestPath, applyManifest(readFileSync(manifestPath, 'utf8')), 'utf8');
process.stdout.write(
  `${JSON.stringify({ prepared: true, source, factory, startBlock }, null, 2)}\n`,
);

function resolveDeployment(): { factory: string; startBlock: number; source: string } {
  if (args.factory || args['start-block']) {
    const factory = requireAddress('--factory', args.factory);
    const startBlock = requireBlock('--start-block', args['start-block']);
    return { factory, startBlock, source: 'command arguments' };
  }
  const record = JSON.parse(readFileSync(deploymentPath, 'utf8')) as {
    status?: string;
    factory?: string | null;
    deploymentBlock?: number | null;
    chainId?: number;
  };
  if (record.status !== 'deployed') {
    fail(
      `deployment metadata reports status "${String(record.status)}"; ` +
        'record a verified deployment or pass --factory and --start-block',
    );
  }
  if (record.chainId !== 5_042_002) fail('deployment metadata is not Arc testnet');
  const factory = requireAddress('factory', record.factory ?? undefined);
  const startBlock = requireBlock('deploymentBlock', String(record.deploymentBlock ?? ''));
  return { factory, startBlock, source: deploymentPath };
}

function applyManifest(text: string): string {
  let inSource = false;
  let replacedAddress = false;
  let replacedBlock = false;
  const lines = text.split('\n').map((line) => {
    if (/^\s{4}source:\s*$/.test(line)) {
      inSource = true;
      return line;
    }
    if (inSource && /^\s{4}\S/.test(line)) inSource = false;
    if (!inSource) return line;
    if (/^\s{6}address:/.test(line)) {
      replacedAddress = true;
      return line.replace(/address:.*/, `address: '${factory}'`);
    }
    if (/^\s{6}startBlock:/.test(line)) {
      replacedBlock = true;
      return line.replace(/startBlock:.*/, `startBlock: ${startBlock}`);
    }
    return line;
  });
  if (!replacedAddress || !replacedBlock) fail('subgraph.yaml has no factory source to update');
  return lines.join('\n');
}

function parseArgs(argv: string[]): Record<string, string | undefined> {
  const parsed: Record<string, string | undefined> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token?.startsWith('--')) continue;
    const [name, inline] = token.slice(2).split('=');
    if (!name) continue;
    parsed[name] = inline ?? argv[index + 1];
    if (inline === undefined) index += 1;
  }
  return parsed;
}

function requireAddress(field: string, value: string | undefined): string {
  if (!value || !/^0x[0-9a-fA-F]{40}$/.test(value)) fail(`${field} is not a valid address`);
  if (/^0x0{39}[01]$/.test(value!)) fail(`${field} is still the placeholder address`);
  return value!;
}

function requireBlock(field: string, value: string | undefined): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) fail(`${field} is not a start block`);
  return parsed;
}

function fail(reason: string): never {
  process.stderr.write(`subgraph preparation refused: ${reason}\n`);
  process.exit(1);
}
