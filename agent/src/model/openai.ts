import OpenAI from 'openai';
import type { JsonModel } from './types.js';

export const DEFAULT_OPENAI_MODEL = 'gpt-5.5-2026-04-23';

export class OpenAIJsonModel implements JsonModel {
  readonly #client: OpenAI;
  readonly #model: string;

  constructor(options: { apiKey: string; model?: string }) {
    if (!options.apiKey) throw new Error('OPENAI_API_KEY is required');
    this.#client = new OpenAI({ apiKey: options.apiKey });
    this.#model = options.model ?? DEFAULT_OPENAI_MODEL;
  }

  async completeJson<T>(request: {
    instructions: string;
    input: string;
    name: string;
    schema: Record<string, unknown>;
    maxOutputTokens: number;
  }): Promise<T> {
    const response = await this.#client.responses.create({
      model: this.#model,
      instructions: request.instructions,
      input: request.input,
      max_output_tokens: request.maxOutputTokens,
      store: false,
      tools: [],
      text: {
        format: {
          type: 'json_schema',
          name: request.name,
          strict: true,
          schema: request.schema,
        },
      },
    });
    if (response.status !== 'completed' || !response.output_text) {
      throw new Error(`Model response was ${response.status}`);
    }
    return JSON.parse(response.output_text) as T;
  }
}
