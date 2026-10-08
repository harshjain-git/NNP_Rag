export interface GenerateOptions {
  temperature?: number | undefined;
  maxTokens?: number | undefined;
  systemPrompt?: string | undefined;
}

export interface LLMProvider {
  readonly providerName: string;
  readonly modelName: string;
  generate(prompt: string, options?: GenerateOptions): Promise<string>;
}
