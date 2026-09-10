import { HttpAgent, type BaseEvent, type Message } from '@ag-ui/client';

export type AgentHistoryMessage = {
  id: string;
  role: 'agent' | 'user';
  text: string;
};

export type AgentToolResult = {
  callId: string;
  source: 'aave' | 'gol';
  tool: string;
  result: unknown;
  handoff: Record<string, unknown> | null;
};

export type RunGolAgentOptions = {
  threadId: string;
  history: AgentHistoryMessage[];
  ownerAddress?: string | null | undefined;
  mandateReady: boolean;
  abortController: AbortController;
  onEvent?: ((event: BaseEvent) => void) | undefined;
  onStatus?: ((status: string) => void) | undefined;
  onText?: ((text: string) => void) | undefined;
  onToolStart?: ((callId: string, name: string) => void) | undefined;
  onToolResult?: ((tool: AgentToolResult) => void) | undefined;
};

export type RunGolAgentResult = {
  text: string;
  tool: AgentToolResult | null;
};

function asMessages(history: AgentHistoryMessage[]): Message[] {
  return history.map((message) => ({
    id: message.id,
    role: message.role === 'agent' ? 'assistant' : 'user',
    content: message.text,
  }));
}

function parseToolResult(content: string, callId: string, name: string): AgentToolResult {
  try {
    const payload = JSON.parse(content) as Record<string, unknown>;
    const source = payload.source === 'gol' ? 'gol' : 'aave';
    return {
      callId,
      source,
      tool: typeof payload.tool === 'string' ? payload.tool : name,
      result: source === 'aave' && 'result' in payload ? payload.result : payload,
      handoff: source === 'gol' && payload.kind === 'client_handoff' ? payload : null,
    };
  } catch {
    return { callId, source: 'aave', tool: name, result: content, handoff: null };
  }
}

function latestAssistantText(messages: ReadonlyArray<Readonly<Message>>): string {
  for (const message of [...messages].reverse()) {
    if (message.role === 'assistant' && typeof message.content === 'string' && message.content) {
      return message.content;
    }
  }
  return '';
}

export async function runGolAgent(options: RunGolAgentOptions): Promise<RunGolAgentResult> {
  const initialMessages = asMessages(options.history);
  const initialIds = new Set(initialMessages.map((message) => message.id));
  const agent = new HttpAgent({
    agentId: 'gol-agent',
    url: '/api/agent/run',
    threadId: options.threadId,
    initialMessages,
    initialState: {
      ownerAddress: options.ownerAddress ?? null,
      mandateReady: options.mandateReady,
    },
  });
  const toolNames = new Map<string, string>();
  let streamedText = '';
  let toolResult: AgentToolResult | null = null;
  let runError: Error | null = null;

  const result = await agent.runAgent(
    { abortController: options.abortController },
    {
      onEvent({ event }) {
        options.onEvent?.(event);
      },
      onRunStartedEvent() {
        options.onStatus?.('Planning with LangGraph');
      },
      onStepStartedEvent({ event }) {
        options.onStatus?.(
          event.stepName === 'route_request'
            ? 'Selecting a safe tool'
            : event.stepName === 'tools'
              ? 'Running the selected tool'
              : 'Preparing the response',
        );
      },
      onToolCallStartEvent({ event }) {
        toolNames.set(event.toolCallId, event.toolCallName);
        options.onToolStart?.(event.toolCallId, event.toolCallName);
        options.onStatus?.(`Calling ${event.toolCallName.replaceAll('_', ' ')}`);
      },
      onToolCallResultEvent({ event }) {
        const parsed = parseToolResult(
          event.content,
          event.toolCallId,
          toolNames.get(event.toolCallId) ?? 'unknown_tool',
        );
        toolResult = parsed;
        options.onToolResult?.(parsed);
        options.onStatus?.('Rendering the tool result');
      },
      onTextMessageContentEvent({ textMessageBuffer }) {
        streamedText = textMessageBuffer;
        options.onText?.(textMessageBuffer);
      },
      onMessagesChanged({ messages }) {
        const newAssistantMessages = messages.filter(
          (message) => message.role === 'assistant' && !initialIds.has(message.id),
        );
        const text = latestAssistantText(newAssistantMessages);
        if (text) {
          streamedText = text;
          options.onText?.(text);
        }
      },
      onRunErrorEvent({ event }) {
        runError = new Error(event.message);
      },
    },
  );

  if (runError) throw runError;
  const finalText =
    streamedText || latestAssistantText(result.newMessages) || 'The agent run completed.';
  return { text: finalText, tool: toolResult };
}
