'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, LayoutGrid, LoaderCircle, Moon, Sun } from 'lucide-react';
import { AaveLogo } from '@/components/ui/aave-logo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GolLogo } from '@/components/ui/gol-logo';
import { GOL_TOOLS } from '@/lib/gol-tool-registry';

type ThemeMode = 'dark' | 'light';

type McpTool = {
  name: string;
  title?: string | undefined;
  description?: string | undefined;
  annotations?:
    | {
        readOnlyHint?: boolean | undefined;
        destructiveHint?: boolean | undefined;
      }
    | undefined;
};

const ALL_TOOLS = 'All tools';

function categoryFor(tool: McpTool): string {
  const name = tool.name.toLowerCase();
  if (/governance|proposal|vote|guide|started/.test(name)) return 'Governance and guidance';
  if (/sgho|stkgho/.test(name)) return 'sGHO';
  if (/swap|order/.test(name)) return 'Swaps and orders';
  if (/reward/.test(name)) return 'Rewards';
  if (/prepare|preview|liquidation|collateral|emode/.test(name)) return 'Action preparation';
  if (/user|position|activity|transaction/.test(name)) return 'Positions and activity';
  return 'Markets and protocol';
}

function normalTitle(tool: McpTool): string {
  if (tool.title?.trim()) return tool.title.trim();
  return tool.name.replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}

function shortDescription(description?: string): string {
  if (!description?.trim()) return 'No description was returned by MCP discovery.';
  const summary = description
    .trim()
    .split(/(?<=[.!?])\s+/)
    .slice(0, 2)
    .join(' ');
  if (summary.length <= 145) return summary;
  const candidate = summary.slice(0, 142);
  const lastSpace = candidate.lastIndexOf(' ');
  return `${candidate.slice(0, lastSpace > 105 ? lastSpace : 142)}…`;
}

function parseTools(payload: unknown): McpTool[] {
  if (!payload || typeof payload !== 'object' || !('tools' in payload)) return [];
  const tools = (payload as { tools?: unknown }).tools;
  if (!Array.isArray(tools)) return [];
  return tools.flatMap((candidate) => {
    if (!candidate || typeof candidate !== 'object') return [];
    const record = candidate as Record<string, unknown>;
    if (typeof record.name !== 'string') return [];
    const annotations =
      record.annotations && typeof record.annotations === 'object'
        ? (record.annotations as McpTool['annotations'])
        : undefined;
    return [
      {
        name: record.name,
        ...(typeof record.title === 'string' ? { title: record.title } : {}),
        ...(typeof record.description === 'string' ? { description: record.description } : {}),
        ...(annotations ? { annotations } : {}),
      },
    ];
  });
}

export function ToolDirectory() {
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const [tools, setTools] = useState<McpTool[]>([]);
  const [selectedCategory, setSelectedCategory] = useState(ALL_TOOLS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem('gol-theme');
    if (savedTheme === 'dark' || savedTheme === 'light') setTheme(savedTheme);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/aave/mcp', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Aave MCP tool discovery is unavailable.');
        const discovered = parseTools(await response.json());
        if (!discovered.length) throw new Error('Aave MCP returned no tools.');
        setTools(discovered);
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') return;
        setError(caught instanceof Error ? caught.message : 'Tool discovery failed.');
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  const categories = useMemo(
    () => [ALL_TOOLS, ...Array.from(new Set(tools.map(categoryFor)))],
    [tools],
  );
  const visibleTools = useMemo(
    () =>
      selectedCategory === ALL_TOOLS
        ? tools
        : tools.filter((tool) => categoryFor(tool) === selectedCategory),
    [selectedCategory, tools],
  );

  const selectTheme = (nextTheme: ThemeMode) => {
    setTheme(nextTheme);
    window.localStorage.setItem('gol-theme', nextTheme);
  };

  return (
    <main
      className={`theme-${theme} min-h-screen bg-background px-4 py-8 text-foreground sm:px-8 sm:py-10`}
    >
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-6 border-b border-border pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <GolLogo className="size-8" />
              <span className="font-mono text-xs font-semibold uppercase tracking-[.2em] text-primary">
                GOL Agent
              </span>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">Connected tools</h1>
            <p className="mt-2 max-w-2xl text-sm leading-copy text-muted-foreground">
              GOL-native account actions and connected Aave MCP capabilities available to the agent.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-border bg-card p-1">
              <Button
                type="button"
                variant={theme === 'light' ? 'secondary' : 'ghost'}
                size="icon"
                className="size-7"
                aria-label="Use light theme"
                onClick={() => selectTheme('light')}
              >
                <Sun size={14} />
              </Button>
              <Button
                type="button"
                variant={theme === 'dark' ? 'secondary' : 'ghost'}
                size="icon"
                className="size-7"
                aria-label="Use dark theme"
                onClick={() => selectTheme('dark')}
              >
                <Moon size={14} />
              </Button>
            </div>
            <Button asChild variant="outline" size="sm">
              <a href="/preview">
                <LayoutGrid size={14} /> Card gallery
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href="/">
                <ArrowLeft size={14} /> Back to GOL
              </a>
            </Button>
          </div>
        </header>

        <section className="py-8" aria-labelledby="tool-directory-heading">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 id="tool-directory-heading" className="text-xl font-semibold">
                GOL internal tools
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Wallet, payment, spending-limit, activity, and security actions.
              </p>
            </div>
            <Badge variant="default" className="w-fit">
              {loading
                ? `${GOL_TOOLS.length} GOL tools. Discovering Aave...`
                : `${GOL_TOOLS.length + tools.length} tools available`}
            </Badge>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {GOL_TOOLS.map((tool) => (
              <Card
                key={tool.name}
                data-tool-name={tool.name}
                data-tool-source="gol"
                className="flex h-72 min-w-0 flex-col overflow-hidden shadow-panel"
              >
                <CardHeader className="min-h-20 shrink-0 flex-row items-start justify-between gap-3 border-b border-border p-4">
                  <div className="flex min-w-0 items-start gap-2">
                    <GolLogo className="mt-0.5 size-6 shrink-0" />
                    <div className="min-w-0">
                      <CardTitle className="text-sm leading-copy">{tool.title}</CardTitle>
                      <span className="mt-1 block text-[10px] text-muted-foreground">
                        {tool.category}
                      </span>
                    </div>
                  </div>
                  <Badge
                    variant={tool.authority === 'Read only' ? 'secondary' : 'warning'}
                    className="shrink-0"
                  >
                    {tool.authority}
                  </Badge>
                </CardHeader>
                <CardContent className="flex min-h-0 flex-1 flex-col p-4">
                  <p className="min-h-0 flex-1 overflow-y-auto pr-2 text-xs leading-copy text-muted-foreground [scrollbar-gutter:stable]">
                    {tool.description}
                  </p>
                  <code className="mt-3 block shrink-0 truncate border-t border-border pt-3 text-[10px] text-muted-foreground">
                    {tool.name}
                  </code>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-14 flex flex-col gap-4 border-t border-border pt-10 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Aave MCP tools</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Titles and permissions come from live MCP discovery.
              </p>
            </div>
            {!loading && !error && (
              <Badge variant="secondary" className="w-fit">
                {tools.length} connected tools
              </Badge>
            )}
          </div>

          {!loading && !error && (
            <nav className="mt-6 flex flex-wrap gap-2" aria-label="Tool categories">
              {categories.map((category) => (
                <Button
                  key={category}
                  type="button"
                  size="sm"
                  variant={selectedCategory === category ? 'default' : 'outline'}
                  className="rounded-full"
                  onClick={() => setSelectedCategory(category)}
                >
                  {category}
                </Button>
              ))}
            </nav>
          )}

          {loading && (
            <div className="mt-12 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle size={17} className="animate-spin text-primary" /> Discovering Aave MCP
              tools
            </div>
          )}

          {error && (
            <Card className="mt-8 border-warning/20 bg-warning/10 shadow-none">
              <CardContent className="p-5 text-sm text-warning">{error}</CardContent>
            </Card>
          )}

          {!loading && !error && (
            <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {visibleTools.map((tool) => {
                const destructive = tool.annotations?.destructiveHint === true;
                return (
                  <Card
                    key={tool.name}
                    data-tool-name={tool.name}
                    data-tool-source="aave"
                    className="flex h-72 min-w-0 flex-col overflow-hidden shadow-panel"
                  >
                    <CardHeader className="min-h-20 shrink-0 flex-row items-start justify-between gap-3 border-b border-border p-4">
                      <div className="flex min-w-0 items-start gap-2">
                        <AaveLogo className="mt-0.5 size-6 shrink-0" />
                        <div className="min-w-0">
                          <CardTitle className="text-sm leading-copy">
                            {normalTitle(tool)}
                          </CardTitle>
                          <span className="mt-1 block text-[10px] text-muted-foreground">
                            {categoryFor(tool)}
                          </span>
                        </div>
                      </div>
                      <Badge variant={destructive ? 'warning' : 'secondary'} className="shrink-0">
                        {destructive ? 'Wallet gated' : 'Read or prepare'}
                      </Badge>
                    </CardHeader>
                    <CardContent className="flex min-h-0 flex-1 flex-col p-4">
                      <p className="min-h-0 flex-1 overflow-y-auto pr-2 text-xs leading-copy text-muted-foreground [scrollbar-gutter:stable]">
                        {shortDescription(tool.description)}
                      </p>
                      <code className="mt-3 block shrink-0 truncate border-t border-border pt-3 text-[10px] text-muted-foreground">
                        {tool.name}
                      </code>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
