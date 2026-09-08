export interface JsonModel {
  completeJson<T>(request: {
    instructions: string;
    input: string;
    name: string;
    schema: Record<string, unknown>;
    maxOutputTokens: number;
  }): Promise<T>;
}
