import { describe, expect, it } from 'vitest';
import {
  chatHistoryStorageKey,
  parseChatHistory,
  serializeChatHistory,
  type PersistedChatMessage,
} from '@/client/chat-history';

describe('agent chat history', () => {
  it('round trips messages and the LangGraph thread per owner', () => {
    const messages: Array<PersistedChatMessage & { streaming?: boolean }> = [
      { id: 'user-1', role: 'user', text: 'Pay 2 USDC' },
      {
        id: 'agent-1',
        role: 'agent',
        text: 'Review the payment.',
        streaming: true,
        action: {
          kind: 'mandate',
          title: 'GOL payment',
          asset: 'USDC',
          amount: '2',
          network: 'Arc testnet',
        },
        toolRuns: [{ id: 'tool-1', name: 'preview_instruction', source: 'gol', state: 'complete' }],
      },
    ];

    expect(parseChatHistory(serializeChatHistory(messages, 'thread-1'))).toEqual({
      messages: messages.map(({ streaming: _streaming, ...message }) => message),
      threadId: 'thread-1',
    });
    expect(chatHistoryStorageKey('0xAbC')).toBe('gol:agent-chat:v1:0xabc');
  });

  it('marks a run interrupted by reload as failed instead of restoring an endless spinner', () => {
    const messages: PersistedChatMessage[] = [
      {
        id: 'agent-1',
        role: 'agent',
        text: '',
        toolRuns: [{ id: 'tool-1', name: 'pay', source: 'gol', state: 'running' }],
      },
    ];

    expect(
      parseChatHistory(serializeChatHistory(messages, null)).messages[0]?.toolRuns?.[0]?.state,
    ).toBe('failed');
  });

  it('rejects malformed or unbounded browser data', () => {
    expect(parseChatHistory('{')).toEqual({ messages: [], threadId: null });
    expect(parseChatHistory('x'.repeat(250_001))).toEqual({ messages: [], threadId: null });
    expect(
      parseChatHistory(
        JSON.stringify({ version: 1, threadId: null, messages: [{ role: 'user' }] }),
      ),
    ).toEqual({ messages: [], threadId: null });
  });

  it('keeps only the most recent 50 messages', () => {
    const messages = Array.from({ length: 60 }, (_, index) => ({
      id: `message-${index}`,
      role: 'user' as const,
      text: String(index),
    }));

    const restored = parseChatHistory(serializeChatHistory(messages, null));
    expect(restored.messages).toHaveLength(50);
    expect(restored.messages[0]?.id).toBe('message-10');
  });
});
