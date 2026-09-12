const STORAGE_VERSION = 1;
const MAX_STORED_CHARACTERS = 250_000;
const MAX_MESSAGES = 50;
const MAX_TEXT_CHARACTERS = 20_000;
const MAX_IDENTIFIER_CHARACTERS = 200;
const MAX_TOOL_RUNS = 20;

export type PersistedProtocolAction = {
  kind: 'aave' | 'mandate' | 'bridge';
  title: string;
  asset: string;
  amount: string;
  network: string;
  blocked?: boolean | undefined;
};

export type PersistedToolRun = {
  id: string;
  name: string;
  source: 'aave' | 'gol';
  state: 'running' | 'complete' | 'failed';
};

export type PersistedChatMessage = {
  id: string;
  role: 'agent' | 'user';
  text: string;
  tool?: string | undefined;
  source?: 'aave' | 'gol' | undefined;
  result?: unknown;
  action?: PersistedProtocolAction | undefined;
  handoff?: Record<string, unknown> | undefined;
  toolRuns?: PersistedToolRun[] | undefined;
};

export type ChatHistory = {
  messages: PersistedChatMessage[];
  threadId: string | null;
};

export function chatHistoryStorageKey(ownerAddress: string): string {
  return `gol:agent-chat:v${STORAGE_VERSION}:${ownerAddress.toLowerCase()}`;
}

export function parseChatHistory(value: string | null): ChatHistory {
  if (!value || value.length > MAX_STORED_CHARACTERS) return emptyHistory();

  try {
    const parsed = JSON.parse(value) as unknown;
    if (
      !isRecord(parsed) ||
      parsed.version !== STORAGE_VERSION ||
      !Array.isArray(parsed.messages)
    ) {
      return emptyHistory();
    }

    const threadId = optionalText(parsed.threadId, MAX_IDENTIFIER_CHARACTERS) ?? null;
    const messages = parsed.messages
      .slice(-MAX_MESSAGES)
      .map(parseMessage)
      .filter((message): message is PersistedChatMessage => message !== null);
    return { messages, threadId };
  } catch {
    return emptyHistory();
  }
}

export function serializeChatHistory(
  messages: ReadonlyArray<PersistedChatMessage & { streaming?: boolean | undefined }>,
  threadId: string | null,
): string {
  let storedMessages = messages
    .slice(-MAX_MESSAGES)
    .map(parseMessage)
    .filter((message): message is PersistedChatMessage => message !== null)
    .map(markInterruptedRunsFailed);
  const safeThreadId = optionalText(threadId, MAX_IDENTIFIER_CHARACTERS) ?? null;

  let serialized = stringify(storedMessages, safeThreadId);
  if (serialized.length <= MAX_STORED_CHARACTERS) return serialized;

  storedMessages = storedMessages.map(({ result: _result, ...message }) => message);
  serialized = stringify(storedMessages, safeThreadId);
  if (serialized.length <= MAX_STORED_CHARACTERS) return serialized;

  storedMessages = storedMessages.slice(-20).map((message) => ({
    ...message,
    text: message.text.slice(0, 4_000),
    handoff: undefined,
  }));
  return stringify(storedMessages, safeThreadId);
}

function stringify(messages: PersistedChatMessage[], threadId: string | null): string {
  try {
    return JSON.stringify({ version: STORAGE_VERSION, threadId, messages });
  } catch {
    return JSON.stringify({ version: STORAGE_VERSION, threadId, messages: [] });
  }
}

function parseMessage(value: unknown): PersistedChatMessage | null {
  if (!isRecord(value)) return null;
  const id = requiredText(value.id, MAX_IDENTIFIER_CHARACTERS);
  const text = requiredText(value.text, MAX_TEXT_CHARACTERS, true);
  const role = value.role === 'agent' || value.role === 'user' ? value.role : null;
  if (!id || text === null || !role) return null;

  const tool = optionalText(value.tool, MAX_IDENTIFIER_CHARACTERS);
  const source = value.source === 'aave' || value.source === 'gol' ? value.source : undefined;
  const action = parseAction(value.action);
  const handoff = isRecord(value.handoff) ? value.handoff : undefined;
  const toolRuns = Array.isArray(value.toolRuns)
    ? value.toolRuns
        .slice(-MAX_TOOL_RUNS)
        .map(parseToolRun)
        .filter((run): run is PersistedToolRun => run !== null)
    : undefined;

  return {
    id,
    role,
    text,
    ...(tool ? { tool } : {}),
    ...(source ? { source } : {}),
    ...('result' in value ? { result: value.result } : {}),
    ...(action ? { action } : {}),
    ...(handoff ? { handoff } : {}),
    ...(toolRuns?.length ? { toolRuns } : {}),
  };
}

function parseAction(value: unknown): PersistedProtocolAction | undefined {
  if (!isRecord(value)) return undefined;
  const kind =
    value.kind === 'aave' || value.kind === 'mandate' || value.kind === 'bridge'
      ? value.kind
      : null;
  const title = requiredText(value.title, MAX_IDENTIFIER_CHARACTERS);
  const asset = requiredText(value.asset, MAX_IDENTIFIER_CHARACTERS);
  const amount = requiredText(value.amount, MAX_IDENTIFIER_CHARACTERS);
  const network = requiredText(value.network, MAX_IDENTIFIER_CHARACTERS);
  if (!kind || !title || !asset || !amount || !network) return undefined;
  return {
    kind,
    title,
    asset,
    amount,
    network,
    ...(typeof value.blocked === 'boolean' ? { blocked: value.blocked } : {}),
  };
}

function parseToolRun(value: unknown): PersistedToolRun | null {
  if (!isRecord(value)) return null;
  const id = requiredText(value.id, MAX_IDENTIFIER_CHARACTERS);
  const name = requiredText(value.name, MAX_IDENTIFIER_CHARACTERS);
  const source = value.source === 'aave' || value.source === 'gol' ? value.source : null;
  const state =
    value.state === 'running' || value.state === 'complete' || value.state === 'failed'
      ? value.state
      : null;
  return id && name && source && state ? { id, name, source, state } : null;
}

function markInterruptedRunsFailed(message: PersistedChatMessage): PersistedChatMessage {
  if (!message.toolRuns?.some((run) => run.state === 'running')) return message;
  return {
    ...message,
    toolRuns: message.toolRuns.map((run) =>
      run.state === 'running' ? { ...run, state: 'failed' as const } : run,
    ),
  };
}

function requiredText(value: unknown, maxLength: number, allowEmpty = false): string | null {
  if (typeof value !== 'string' || value.length > maxLength || (!allowEmpty && !value)) return null;
  return value;
}

function optionalText(value: unknown, maxLength: number): string | undefined {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength
    ? value
    : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function emptyHistory(): ChatHistory {
  return { messages: [], threadId: null };
}
