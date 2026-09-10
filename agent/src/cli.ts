#!/usr/bin/env node
import { Command } from 'commander';

const program = new Command();
program.name('gol').description('Developer-only GOL agent runner').version('0.1.0');

program
  .command('pay')
  .requiredOption('--mandate <id>')
  .requiredOption('--request <bytes32>')
  .requiredOption('--instruction <text>')
  .action(async (options) => {
    print(
      await api('/api/instructions', {
        method: 'POST',
        body: { mandateId: options.mandate, requestId: options.request, text: options.instruction },
      }),
    );
  });

program
  .command('status')
  .requiredOption('--request <bytes32>')
  .action(async (options) =>
    print(await api(`/api/requests/${encodeURIComponent(options.request)}`)),
  );

program
  .command('ask')
  .requiredOption('--question <text>')
  .action(async (options) => {
    print(await api('/api/questions', { method: 'POST', body: { question: options.question } }));
  });

await program.parseAsync();

async function api(path: string, options?: { method: 'POST'; body: unknown }): Promise<unknown> {
  const baseUrl = process.env.GOL_API_URL;
  const token = process.env.GOL_DEV_TOKEN;
  if (!baseUrl || !token) throw new Error('GOL_API_URL and GOL_DEV_TOKEN are required');
  if (!baseUrl.startsWith('https://') && !baseUrl.startsWith('http://127.0.0.1')) {
    throw new Error('GOL_API_URL must use HTTPS outside localhost');
  }
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
    method: options?.method ?? 'GET',
    headers: {
      authorization: `Bearer ${token}`,
      ...(options ? { 'content-type': 'application/json' } : {}),
    },
    ...(options ? { body: JSON.stringify(options.body) } : {}),
  });
  const body = (await response.json()) as unknown;
  if (!response.ok) throw new Error(`GOL API returned ${response.status}: ${JSON.stringify(body)}`);
  return body;
}

function print(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}
